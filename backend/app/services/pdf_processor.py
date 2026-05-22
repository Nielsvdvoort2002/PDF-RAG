import io

import pdfplumber
from app.config import get_settings

settings = get_settings()


def extract_and_chunk(file_bytes: bytes) -> list[str]:
    text = _extract_text(file_bytes)
    if not text.strip():
        return []
    return _chunk(text, settings.chunk_size, settings.chunk_overlap)


def _extract_text(file_bytes: bytes) -> str:
    try:
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            pages = [p.extract_text() for p in pdf.pages]
        return "\n\n".join(p for p in pages if p)
    except Exception as e:
        raise ValueError(f"PDF processing failed: {e}")


def _chunk(text: str, size: int, overlap: int) -> list[str]:
    words = text.split()
    chunks: list[str] = []
    start = 0
    while start < len(words):
        chunks.append(" ".join(words[start : start + size]))
        start += size - overlap
    return chunks
