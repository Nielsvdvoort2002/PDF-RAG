from pydantic import BaseModel


class ReindexResult(BaseModel):
    document_id: str
    chunks: int
    status: str


class ReindexResponse(BaseModel):
    results: list[ReindexResult]
