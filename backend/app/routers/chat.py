import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.models.chat import (
    ChatRequest,
    CreateSessionRequest,
    CreateSessionResponse,
    SessionResponse,
    ChatMessage,
)
from app.services import database, embeddings, llm
from app.services.vector_store import get_vector_store

router = APIRouter()


@router.post("/sessions", response_model=CreateSessionResponse)
async def create_session(body: CreateSessionRequest):
    session_id = database.create_session(body.document_ids)
    return CreateSessionResponse(session_id=session_id)


@router.get("/sessions/{session_id}", response_model=SessionResponse)
async def get_session(session_id: str):
    session = database.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    raw_messages = database.get_messages(session_id)
    messages = [ChatMessage(role=m["role"], content=m["content"]) for m in raw_messages]

    return SessionResponse(
        session_id=session_id,
        document_ids=session["document_ids"],
        messages=messages,
    )


@router.post("/chat")
def chat(request: ChatRequest):
    session = database.get_session(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    query_embedding = embeddings.embed([request.message], input_type="query")[0]

    document_ids = request.document_ids or session.get("document_ids")
    context_chunks = get_vector_store().search(query_embedding, document_ids=document_ids, top_k=3)

    history = database.get_messages(request.session_id)
    messages = llm.build_messages(request.message, context_chunks, history)

    database.save_message(request.session_id, "user", request.message)

    def generate():
        yield json.dumps({"type": "meta", "sources": context_chunks}) + "\n"
        tokens: list[str] = []
        error: str | None = None
        try:
            for token in llm.stream_response(messages):
                tokens.append(token)
                yield json.dumps({"type": "delta", "c": token}) + "\n"
        except Exception as e:
            error = str(e)
        full = "".join(tokens)
        if full:
            database.save_message(request.session_id, "assistant", full)
        if error:
            yield json.dumps({"type": "error", "message": error}) + "\n"
        else:
            yield json.dumps({"type": "end"}) + "\n"

    return StreamingResponse(generate(), media_type="application/x-ndjson")
