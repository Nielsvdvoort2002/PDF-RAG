from abc import ABC, abstractmethod
from functools import lru_cache

from pinecone import Pinecone
from app.config import get_settings

settings = get_settings()


class VectorStore(ABC):
    @abstractmethod
    def add_documents(
        self,
        document_id: str,
        chunks: list[str],
        embeddings: list[list[float]],
    ) -> None: ...

    @abstractmethod
    def search(
        self,
        query_embedding: list[float],
        document_ids: list[str] | None,
        top_k: int,
    ) -> list[dict]: ...

    @abstractmethod
    def delete_document(self, document_id: str) -> None: ...


class PineconeVectorStore(VectorStore):
    def __init__(self) -> None:
        pc = Pinecone(api_key=settings.pinecone_api_key)
        self.index = pc.Index(settings.pinecone_index_name)

    def add_documents(
        self,
        document_id: str,
        chunks: list[str],
        embeddings: list[list[float]],
    ) -> None:
        vectors = [
            {
                "id": f"{document_id}_{i}",
                "values": embedding,
                "metadata": {"document_id": document_id, "text": chunk, "chunk_index": i},
            }
            for i, (chunk, embedding) in enumerate(zip(chunks, embeddings))
        ]
        self.index.upsert(vectors=vectors)

    def search(
        self,
        query_embedding: list[float],
        document_ids: list[str] | None = None,
        top_k: int = 5,
    ) -> list[dict]:
        filter_dict = {"document_id": {"$in": document_ids}} if document_ids else None
        results = self.index.query(
            vector=query_embedding,
            top_k=top_k,
            filter=filter_dict,
            include_metadata=True,
        )
        return [
            {
                "text": match["metadata"]["text"],
                "document_id": match["metadata"]["document_id"],
                "chunk_index": int(match["metadata"]["chunk_index"]),
            }
            for match in results["matches"]
        ]

    def delete_document(self, document_id: str) -> None:
        ids_to_delete = [v["id"] for v in self.index.list(prefix=f"{document_id}_")]
        if ids_to_delete:
            self.index.delete(ids=ids_to_delete)


@lru_cache(maxsize=1)
def get_vector_store() -> VectorStore:
    return PineconeVectorStore()
