from io import BytesIO
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers.upload import _require_upload_key

client = TestClient(app)


@pytest.fixture(autouse=True)
def bypass_upload_key():
    app.dependency_overrides[_require_upload_key] = lambda: None
    yield
    app.dependency_overrides.clear()

MINIMAL_PDF = (
    b"%PDF-1.4\n"
    b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
    b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
    b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
    b"/Contents 4 0 R /Resources << >> >>\nendobj\n"
    b"4 0 obj\n<< /Length 44 >>\nstream\n"
    b"BT /F1 12 Tf 100 700 Td (Hello World) Tj ET\n"
    b"endstream\nendobj\n"
    b"xref\n0 5\n0000000000 65535 f\n"
    b"trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n0\n%%EOF"
)


def test_upload_rejects_non_pdf():
    response = client.post(
        "/api/upload",
        files={"file": ("document.txt", BytesIO(b"plain text"), "text/plain")},
    )
    assert response.status_code == 400


@patch("app.routers.upload.storage.upload_pdf", return_value="documents/abc/test.pdf")
@patch("app.routers.upload.embeddings.embed", return_value=[[0.1] * 384])
@patch("app.routers.upload.pdf_processor.extract_and_chunk", return_value=["chunk one"])
@patch("app.routers.upload.get_vector_store")
def test_upload_success(mock_store, mock_chunk, mock_embed, mock_s3):
    mock_store.return_value.add_documents = MagicMock()

    response = client.post(
        "/api/upload",
        files={"file": ("test.pdf", BytesIO(MINIMAL_PDF), "application/pdf")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["filename"] == "test.pdf"
    assert body["chunk_count"] == 1
    assert "document_id" in body


@patch("app.routers.upload.storage.upload_pdf", return_value=None)
@patch("app.routers.upload.pdf_processor.extract_and_chunk", return_value=[])
def test_upload_empty_pdf_returns_422(_mock_chunk, _mock_s3):
    response = client.post(
        "/api/upload",
        files={"file": ("empty.pdf", BytesIO(b"%PDF-1.4 %%EOF"), "application/pdf")},
    )
    assert response.status_code == 422
