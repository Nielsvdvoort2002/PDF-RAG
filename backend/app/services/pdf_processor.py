import pdfplumber
from app.config import get_settings

settings = get_settings()


def extract_and_chunk(file_bytes: bytes) -> list[str]:
    text = _extract_text(file_bytes)
    if not text.strip():
        return []
    return _chunk(text, settings.chunk_size, settings.chunk_overlap)


def _extract_text(file_bytes: bytes) -> str:
    import io
    pages: list[str] = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                pages.append(page_text)
    return "\n\n".join(pages)


def _chunk(text: str, size: int, overlap: int) -> list[str]:
    words = text.split()
    chunks: list[str] = []
    start = 0
    while start < len(words):
        end = start + size
        chunks.append(" ".join(words[start:end]))
        start += size - overlap
    return chunks
