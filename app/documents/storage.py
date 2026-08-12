import boto3
from botocore.config import Config
from flask import current_app

_UPLOAD_URL_TTL_SECONDS = 300
_DOWNLOAD_URL_TTL_SECONDS = 300


def get_s3_client():
    """Internal client, addressed at the in-network endpoint (minio:9000). Used
    for server-side operations that never leave the compose network."""
    cfg = current_app.config
    return boto3.client(
        "s3",
        endpoint_url=cfg["S3_ENDPOINT_URL"],
        aws_access_key_id=cfg["S3_ACCESS_KEY"],
        aws_secret_access_key=cfg["S3_SECRET_KEY"],
        region_name=cfg["S3_REGION"],
        use_ssl=cfg["S3_USE_SSL"],
    )


def _public_s3_client():
    """Client addressed at the browser-reachable public endpoint, used ONLY to
    presign URLs handed to a browser. The signature is bound to this host, so
    presigning against minio:9000 (internal) produced links the browser could
    neither resolve nor load over HTTPS -- the mixed-content failure. Path-style
    addressing keeps the bucket in the path so no wildcard cert is needed."""
    cfg = current_app.config
    public = cfg["S3_PUBLIC_ENDPOINT_URL"]
    return boto3.client(
        "s3",
        endpoint_url=public,
        aws_access_key_id=cfg["S3_ACCESS_KEY"],
        aws_secret_access_key=cfg["S3_SECRET_KEY"],
        region_name=cfg["S3_REGION"],
        use_ssl=public.startswith("https"),
        config=Config(s3={"addressing_style": "path"}),
    )


def build_s3_key(business_case_id, document_id, version_number: int, original_filename: str) -> str:
    return f"cases/{business_case_id}/documents/{document_id}/v{version_number}/{original_filename}"


def presign_put_url(s3_key: str, content_type: str) -> str:
    client = _public_s3_client()
    return client.generate_presigned_url(
        "put_object",
        Params={"Bucket": current_app.config["S3_BUCKET"], "Key": s3_key, "ContentType": content_type},
        ExpiresIn=_UPLOAD_URL_TTL_SECONDS,
    )


def presign_get_url(s3_key: str) -> str:
    client = _public_s3_client()
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
