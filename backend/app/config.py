from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # AWS
    aws_region: str = "us-east-1"
    s3_bucket_name: str = ""

    # DynamoDB
    dynamodb_sessions_table: str = "pdf-rag-sessions"
    dynamodb_messages_table: str = "pdf-rag-messages"
    dynamodb_documents_table: str = "pdf-rag-documents"
    dynamodb_endpoint_url: str = ""

    # Auth
    upload_api_key: str = ""

    # Groq
    groq_api_key: str = ""
    groq_model: str = "llama-3.1-8b-instant"

    # Pinecone
    pinecone_api_key: str = ""
    pinecone_index_name: str = "pdf-rag"

    # Embeddings
    embedding_model: str = "llama-text-embed-v2"

    # RAG tuning
    chunk_size: int = 512
    chunk_overlap: int = 50

    model_config = {"env_file": ".env"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
