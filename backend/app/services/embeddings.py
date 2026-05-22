from pinecone import Pinecone
from app.config import get_settings

settings = get_settings()
_client = Pinecone(api_key=settings.pinecone_api_key)


def embed(texts: list[str], input_type: str = "passage") -> list[list[float]]:
    result = _client.inference.embed(
        model=settings.embedding_model,
        inputs=texts,
        parameters={"input_type": input_type, "truncate": "END"},
    )
    return [item["values"] for item in result]
