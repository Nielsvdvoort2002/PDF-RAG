from pydantic import BaseModel


class UploadResponse(BaseModel):
    document_id: str
    filename: str
    chunk_count: int
    s3_key: str


class DocumentRecord(BaseModel):
    document_id: str
    filename: str
    chunk_count: int


class DocumentListResponse(BaseModel):
    documents: list[DocumentRecord]
