import uuid
from datetime import datetime, timezone
from functools import lru_cache

import boto3
from boto3.dynamodb.conditions import Key
from app.config import get_settings

settings = get_settings()


@lru_cache(maxsize=1)
def _resource():
    kwargs = {"region_name": settings.aws_region}
    if settings.dynamodb_endpoint_url:
        kwargs["endpoint_url"] = settings.dynamodb_endpoint_url
    return boto3.resource("dynamodb", **kwargs)


def _table(name: str):
    return _resource().Table(name)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Documents ──────────────────────────────────────────────────────────────


def save_document(document_id: str, filename: str, chunk_count: int, s3_key: str) -> None:
    _table(settings.dynamodb_documents_table).put_item(
        Item={
            "document_id": document_id,
            "filename": filename,
            "chunk_count": chunk_count,
            "s3_key": s3_key,
            "created_at": _now(),
        }
    )


def list_documents() -> list[dict]:
    items = _table(settings.dynamodb_documents_table).scan().get("Items", [])
    return sorted(items, key=lambda x: x.get("created_at", ""))


def delete_document(document_id: str) -> None:
    _table(settings.dynamodb_documents_table).delete_item(Key={"document_id": document_id})


def delete_all_documents() -> None:
    table = _table(settings.dynamodb_documents_table)
    items = table.scan().get("Items", [])
    with table.batch_writer() as batch:
        for item in items:
            batch.delete_item(Key={"document_id": item["document_id"]})


# ── Sessions ───────────────────────────────────────────────────────────────


def create_session(document_ids: list[str]) -> str:
    session_id = str(uuid.uuid4())
    _table(settings.dynamodb_sessions_table).put_item(
        Item={
            "session_id": session_id,
            "document_ids": document_ids,
            "created_at": _now(),
        }
    )
    return session_id


def get_session(session_id: str) -> dict | None:
    return (
        _table(settings.dynamodb_sessions_table)
        .get_item(Key={"session_id": session_id})
        .get("Item")
    )


# ── Messages ───────────────────────────────────────────────────────────────


def save_message(session_id: str, role: str, content: str) -> None:
    _table(settings.dynamodb_messages_table).put_item(
        Item={
            "session_id": session_id,
            "timestamp": _now(),
            "message_id": str(uuid.uuid4()),
            "role": role,
            "content": content,
        }
    )


def get_messages(session_id: str) -> list[dict]:
    result = _table(settings.dynamodb_messages_table).query(
        KeyConditionExpression=Key("session_id").eq(session_id),
        ScanIndexForward=True,
    )
    return result.get("Items", [])
