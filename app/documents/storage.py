import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from flask import current_app

_UPLOAD_URL_TTL_SECONDS = 300
_DOWNLOAD_URL_TTL_SECONDS = 300

# Set once, per process, after the bucket is confirmed to exist -- see
# _ensure_bucket_once. Module-level so it is shared across requests in a worker.
_bucket_ensured = False


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
        # signature_version MUST be pinned to s3v4. Without it boto3 presigns with
        # the legacy SigV2 scheme (AWSAccessKeyId/Signature/Expires) and puts
        # content-type in the query string, which MinIO -- validating SigV2 with
        # Content-Type as a *header* -- rejects with SignatureDoesNotMatch. So the
        # browser PUT/GET to the presigned URL failed even though CORS, host and
        # the bucket were all correct. s3v4 signs content-type;host properly.
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )


def build_s3_key(business_case_id, document_id, version_number: int, original_filename: str) -> str:
    return f"cases/{business_case_id}/documents/{document_id}/v{version_number}/{original_filename}"


def presign_put_url(s3_key: str, content_type: str) -> str:
    _ensure_bucket_once()
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
    """Create the documents bucket if it is missing. Idempotent and safe to call
    concurrently: a missing bucket (404) is created; an existing one (or a lost
    create race) is left alone; any other error (403, network) propagates."""
    client = get_s3_client()
    bucket = current_app.config["S3_BUCKET"]
    try:
        client.head_bucket(Bucket=bucket)
        return
    except ClientError as exc:
        code = str(exc.response.get("Error", {}).get("Code", ""))
        if code not in ("404", "NoSuchBucket", "NotFound"):
            raise  # 403 / connectivity / anything else is a real problem
    try:
        client.create_bucket(Bucket=bucket)
    except ClientError as exc:
        code = str(exc.response.get("Error", {}).get("Code", ""))
        if code not in ("BucketAlreadyOwnedByYou", "BucketAlreadyExists"):
            raise


def _ensure_bucket_once() -> None:
    """Self-heal a missing bucket on the upload path. ensure_bucket_exists is
    wired in nowhere else -- app startup deliberately does not depend on MinIO
    being reachable (migrate/CLI/tests import the factory too) -- so the first
    presigned upload in each worker creates the bucket if a MinIO volume reset
    wiped it. Marks done only on success, so a transient MinIO outage is retried
    on the next upload rather than silently skipped forever."""
    global _bucket_ensured
    if _bucket_ensured:
        return
    ensure_bucket_exists()
    _bucket_ensured = True
