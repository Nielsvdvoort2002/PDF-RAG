from functools import lru_cache

from pinecone import Pinecone
from app.config import get_settings


@lru_cache(maxsize=1)
def _client() -> Pinecone:
    return Pinecone(api_key=get_settings().pinecone_api_key)


def embed(texts: list[str], input_type: str = "passage") -> list[list[float]]:
    settings = get_settings()
    result = _client().inference.embed(
        model=settings.embedding_model,
        inputs=texts,
        parameters={"input_type": input_type, "truncate": "END"},
    )
    return [item["values"] for item in result]

