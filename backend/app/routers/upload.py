import uuid

from fastapi import APIRouter, Depends, Header, HTTPException, UploadFile, File

from app.config import get_settings
from app.models.upload import DocumentListResponse, DocumentRecord, UploadResponse
from app.services import database, embeddings, pdf_processor, storage
from app.services.vector_store import get_vector_store

router = APIRouter()
settings = get_settings()


def _require_upload_key(x_upload_key: str = Header(...)):
    if not settings.upload_api_key or x_upload_key != settings.upload_api_key:
        raise HTTPException(status_code=403, detail="Forbidden.")


@router.post("/upload", response_model=UploadResponse, dependencies=[Depends(_require_upload_key)])
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    file_bytes = await file.read()
    document_id = str(uuid.uuid4())

    s3_key = storage.upload_pdf(file_bytes, document_id, file.filename)

    chunks = pdf_processor.extract_and_chunk(file_bytes)
    if not chunks:
        raise HTTPException(status_code=422, detail="Could not extract text from PDF.")

    chunk_embeddings = embeddings.embed(chunks)
    get_vector_store().add_documents(document_id, chunks, chunk_embeddings)
    database.save_document(document_id, file.filename, len(chunks), s3_key)

    return UploadResponse(
        document_id=document_id,
        filename=file.filename,
        chunk_count=len(chunks),
        s3_key=s3_key,
    )


@router.get("/documents", response_model=DocumentListResponse)
def list_documents():
    docs = database.list_documents()
    return DocumentListResponse(
        documents=[
            DocumentRecord(
                document_id=d["document_id"],
                filename=d["filename"],
                chunk_count=int(d["chunk_count"]),
            )
            for d in docs
        ]
    )
