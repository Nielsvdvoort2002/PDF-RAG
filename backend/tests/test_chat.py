from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

FAKE_SESSION = {
    "session_id": "session-123",
    "document_ids": ["doc-abc"],
    "created_at": "2024-01-01T00:00:00+00:00",
}


@patch("app.routers.chat.database.create_session", return_value="session-123")
def test_create_session(mock_create):
    response = client.post("/api/sessions", json={"document_ids": ["doc-abc"]})
    assert response.status_code == 200
    assert response.json()["session_id"] == "session-123"
    mock_create.assert_called_once_with(["doc-abc"])


@patch("app.routers.chat.database.get_session", return_value=None)
def test_get_session_not_found(_):
    response = client.get("/api/sessions/nonexistent")
    assert response.status_code == 404


@patch("app.routers.chat.database.get_messages", return_value=[])
@patch("app.routers.chat.database.get_session", return_value=FAKE_SESSION)
def test_get_session_success(_mock_session, _mock_msgs):
    response = client.get("/api/sessions/session-123")
    assert response.status_code == 200
    body = response.json()
    assert body["session_id"] == "session-123"
    assert body["document_ids"] == ["doc-abc"]


@patch("app.routers.chat.database.save_message")
@patch("app.routers.chat.database.get_messages", return_value=[])
@patch("app.routers.chat.database.get_session", return_value=FAKE_SESSION)
@patch("app.routers.chat.llm.stream_response", return_value=iter(["Hello", " there"]))
@patch("app.routers.chat.llm.build_messages", return_value=[{"role": "user", "content": "Hi"}])
@patch("app.routers.chat.get_vector_store")
@patch("app.routers.chat.embeddings.embed", return_value=[[0.1] * 384])
def test_chat_streams_response(
    _mock_embed,
    mock_store,
    _mock_build,
    _mock_stream,
    _mock_session,
    _mock_msgs,
    _mock_save,
):
    mock_store.return_value.search = MagicMock(
        return_value=[{"text": "ctx", "document_id": "doc-abc", "chunk_index": 0}]
    )

    response = client.post(
        "/api/chat",
        json={"session_id": "session-123", "message": "Hi"},
    )

    assert response.status_code == 200
    assert "application/x-ndjson" in response.headers["content-type"]
    assert b'"type": "delta"' in response.content


@patch("app.routers.chat.database.get_session", return_value=None)
def test_chat_missing_session(_):
    response = client.post(
        "/api/chat",
        json={"session_id": "bad-id", "message": "Hi"},
    )
    assert response.status_code == 404
