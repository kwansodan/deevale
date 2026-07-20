import boto3
from flask import current_app

_UPLOAD_URL_TTL_SECONDS = 300
_DOWNLOAD_URL_TTL_SECONDS = 300


def get_s3_client():
    cfg = current_app.config
    return boto3.client(
        "s3",
        endpoint_url=cfg["S3_ENDPOINT_URL"],
        aws_access_key_id=cfg["S3_ACCESS_KEY"],
        aws_secret_access_key=cfg["S3_SECRET_KEY"],
        region_name=cfg["S3_REGION"],
        use_ssl=cfg["S3_USE_SSL"],
    )


def build_s3_key(business_case_id, document_id, version_number: int, original_filename: str) -> str:
    return f"cases/{business_case_id}/documents/{document_id}/v{version_number}/{original_filename}"


def presign_put_url(s3_key: str, content_type: str) -> str:
    client = get_s3_client()
    return client.generate_presigned_url(
        "put_object",
        Params={"Bucket": current_app.config["S3_BUCKET"], "Key": s3_key, "ContentType": content_type},
        ExpiresIn=_UPLOAD_URL_TTL_SECONDS,
    )


def presign_get_url(s3_key: str) -> str:
    client = get_s3_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": current_app.config["S3_BUCKET"], "Key": s3_key},
        ExpiresIn=_DOWNLOAD_URL_TTL_SECONDS,
    )


def ensure_bucket_exists() -> None:
    client = get_s3_client()
    bucket = current_app.config["S3_BUCKET"]
    try:
        client.head_bucket(Bucket=bucket)
    except Exception:
        client.create_bucket(Bucket=bucket)
