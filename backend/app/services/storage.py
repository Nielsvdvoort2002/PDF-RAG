from functools import lru_cache

import boto3
from app.config import get_settings

settings = get_settings()


@lru_cache(maxsize=1)
def _client():
    return boto3.client("s3", region_name=settings.aws_region)


def upload_pdf(file_bytes: bytes, document_id: str, filename: str) -> str:
    key = f"documents/{document_id}/{filename}"
    _client().put_object(
        Bucket=settings.s3_bucket_name,
        Key=key,
        Body=file_bytes,
        ContentType="application/pdf",
    )
    return key


def delete_pdf(s3_key: str) -> None:
    _client().delete_object(Bucket=settings.s3_bucket_name, Key=s3_key)


def download_pdf(s3_key: str) -> bytes:
    return _client().get_object(Bucket=settings.s3_bucket_name, Key=s3_key)["Body"].read()
