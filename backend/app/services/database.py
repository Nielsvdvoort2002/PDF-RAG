import uuid
from datetime import datetime, timezone

import boto3
from boto3.dynamodb.conditions import Key
from app.config import get_settings

settings = get_settings()


def _resource():
    return boto3.resource("dynamodb", region_name=settings.aws_region)


# ── Documents ──────────────────────────────────────────────────────────────


def save_document(document_id: str, filename: str, chunk_count: int, s3_key: str) -> None:
    _resource().Table(settings.dynamodb_documents_table).put_item(
        Item={
            "document_id": document_id,
            "filename": filename,
            "chunk_count": chunk_count,
            "s3_key": s3_key,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )


def list_documents() -> list[dict]:
    result = _resource().Table(settings.dynamodb_documents_table).scan()
    items = result.get("Items", [])
    return sorted(items, key=lambda x: x.get("created_at", ""))


# ── Sessions ───────────────────────────────────────────────────────────────


def create_session(document_ids: list[str]) -> str:
    session_id = str(uuid.uuid4())
    _resource().Table(settings.dynamodb_sessions_table).put_item(
        Item={
            "session_id": session_id,
            "document_ids": document_ids,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    return session_id


def get_session(session_id: str) -> dict | None:
    result = _resource().Table(settings.dynamodb_sessions_table).get_item(
        Key={"session_id": session_id}
    )
    return result.get("Item")


# ── Messages ───────────────────────────────────────────────────────────────


def save_message(session_id: str, role: str, content: str) -> None:
    _resource().Table(settings.dynamodb_messages_table).put_item(
        Item={
            "session_id": session_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "message_id": str(uuid.uuid4()),
            "role": role,
            "content": content,
        }
    )


def get_messages(session_id: str) -> list[dict]:
    result = _resource().Table(settings.dynamodb_messages_table).query(
        KeyConditionExpression=Key("session_id").eq(session_id),
        ScanIndexForward=True,
    )
    return result.get("Items", [])
