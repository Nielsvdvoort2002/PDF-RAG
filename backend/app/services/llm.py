from collections.abc import Generator
from groq import Groq
from app.config import get_settings

settings = get_settings()


def build_messages(
    user_message: str,
    context_chunks: list[dict],
    history: list[dict],
) -> list[dict]:
    context = "\n\n".join(
        f"[Document: {c['document_id']}, chunk {c['chunk_index']}]\n{c['text']}"
        for c in context_chunks
    )
    system = (
        "You are a helpful assistant that answers questions based on provided PDF documents.\n"
        "Use only the context below to answer. If the answer is not in the context, say so clearly.\n\n"
        f"Context:\n{context}"
    )

    messages: list[dict] = [{"role": "system", "content": system}]
    # Include last 10 turns of history for conversational memory
    messages.extend({"role": m["role"], "content": m["content"]} for m in history[-10:])
    messages.append({"role": "user", "content": user_message})
    return messages


def stream_response(messages: list[dict]) -> Generator[str, None, None]:
    client = Groq(api_key=settings.groq_api_key)
    stream = client.chat.completions.create(
        model=settings.groq_model,
        messages=messages,
        stream=True,
        max_tokens=1024,
        temperature=0.2,
    )
    for chunk in stream:
        content = chunk.choices[0].delta.content
        if content:
            yield content
