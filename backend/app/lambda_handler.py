import base64
import json

from mangum import Mangum

from app.main import app
from app.services import database, embeddings, llm
from app.services.vector_store import get_vector_store

# Handles all non-streaming routes (upload, sessions, health)
_mangum = Mangum(app, lifespan="off")


def _parse_body(event: dict) -> dict:
    body = event.get("body") or "{}"
    if event.get("isBase64Encoded"):
        body = base64.b64decode(body).decode()
    return json.loads(body)


def _sse(payload: dict) -> bytes:
    return f"data: {json.dumps(payload)}\n\n".encode()


def _stream_chat(event: dict):
    """Generator of SSE bytes for /api/chat.

    The Lambda Function URL must have InvokeMode: RESPONSE_STREAM so that
    awslambdaric iterates this generator and sends each chunk to the client
    immediately rather than buffering the full response.
    """
    body = _parse_body(event)
    session = database.get_session(body["session_id"])
    if not session:
        yield _sse({"error": "Session not found."})
        return

    query_vec = embeddings.embed([body["message"]])[0]
    doc_ids = body.get("document_ids") or session["document_ids"]
    chunks = get_vector_store().search(query_vec, document_ids=doc_ids, top_k=5)
    history = database.get_messages(body["session_id"])
    messages = llm.build_messages(body["message"], chunks, history)
    database.save_message(body["session_id"], "user", body["message"])

    tokens: list[str] = []
    for token in llm.stream_response(messages):
        tokens.append(token)
        yield _sse({"content": token})

    database.save_message(body["session_id"], "assistant", "".join(tokens))
    yield _sse({
        "done": True,
        "sources": [
            {"text": c["text"], "document_id": c["document_id"], "chunk_index": c["chunk_index"]}
            for c in chunks
        ],
    })


def handler(event, context):
    path = event.get("rawPath", "")
    method = event.get("requestContext", {}).get("http", {}).get("method", "GET")

    if path == "/api/chat" and method == "POST":
        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
            },
            "body": _stream_chat(event),
        }

    return _mangum(event, context)
