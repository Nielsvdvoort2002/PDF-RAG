import boto3
from app.config import get_settings

settings = get_settings()


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


def get_presigned_url(key: str, expires_in: int = 3600) -> str:
    return _client().generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.s3_bucket_name, "Key": key},
        ExpiresIn=expires_in,
    )
