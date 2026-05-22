from collections.abc import Iterator

from groq import Groq
from app.config import get_settings

settings = get_settings()
_client = Groq(api_key=settings.groq_api_key)


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
    messages.extend({"role": m["role"], "content": m["content"]} for m in history[-10:])
    messages.append({"role": "user", "content": user_message})
    return messages


def stream_response(messages: list[dict]) -> Iterator[str]:
    with _client.chat.completions.create(
        model=settings.groq_model,
        messages=messages,
        max_tokens=1024,
        temperature=0.2,
        stream=True,
    ) as stream:
        for chunk in stream:
            content = chunk.choices[0].delta.content
            if content:
                yield content
