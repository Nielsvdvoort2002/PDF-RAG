import uuid

from fastapi import APIRouter, Depends, Header, HTTPException, UploadFile, File

from app.config import get_settings
from app.models.upload import DocumentListResponse, DocumentRecord, UploadResponse
from app.services import database, embeddings, pdf_processor, storage
from app.services.vector_store import get_vector_store
from app.models.reindex import ReindexResponse, ReindexResult

router = APIRouter()
settings = get_settings()


def _require_upload_key(x_upload_key: str = Header(...)):
    upload_key = x_upload_key.strip()
    if not settings.upload_api_key or upload_key != settings.upload_api_key:
        raise HTTPException(status_code=403, detail="Invalid upload key.")


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


@router.post("/reindex", response_model=ReindexResponse, dependencies=[Depends(_require_upload_key)])
def reindex():
    docs = database.list_documents()
    results: list[ReindexResult] = []
    for doc in docs:
        try:
            file_bytes = storage.download_pdf(doc["s3_key"])
            chunks = pdf_processor.extract_and_chunk(file_bytes)
            if chunks:
                chunk_embeddings = embeddings.embed(chunks)
                get_vector_store().add_documents(doc["document_id"], chunks, chunk_embeddings)
            results.append(ReindexResult(document_id=doc["document_id"], chunks=len(chunks), status="ok"))
        except Exception as e:
            results.append(ReindexResult(document_id=doc["document_id"], chunks=0, status=f"error: {e}"))
    return ReindexResponse(results=results)


@router.delete("/documents/{document_id}", dependencies=[Depends(_require_upload_key)])
def delete_document(document_id: str):
    docs = database.list_documents()
    doc = next((d for d in docs if d["document_id"] == document_id), None)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    get_vector_store().delete_document(document_id)
    storage.delete_pdf(doc["s3_key"])
    database.delete_document(document_id)
    return {"deleted": document_id}


@router.delete("/documents", dependencies=[Depends(_require_upload_key)])
def clear_documents():
    docs = database.list_documents()
    for doc in docs:
        try:
            get_vector_store().delete_document(doc["document_id"])
        except Exception:
            pass
        try:
            storage.delete_pdf(doc["s3_key"])
        except Exception:
            pass
    database.delete_all_documents()
    return {"deleted": len(docs)}


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
