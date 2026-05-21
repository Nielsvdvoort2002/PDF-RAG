from functools import lru_cache
from fastembed import TextEmbedding
from app.config import get_settings

settings = get_settings()


@lru_cache(maxsize=1)
def _get_model() -> TextEmbedding:
    return TextEmbedding(model_name=settings.embedding_model)


def embed(texts: list[str]) -> list[list[float]]:
    model = _get_model()
    return [vec.tolist() for vec in model.embed(texts)]
