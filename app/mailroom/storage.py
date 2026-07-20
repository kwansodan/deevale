from app.documents.storage import get_s3_client, presign_get_url, presign_put_url

__all__ = ["build_mail_s3_key", "get_s3_client", "presign_get_url", "presign_put_url"]


def build_mail_s3_key(business_case_id, mail_item_id, original_filename: str) -> str:
    return f"cases/{business_case_id}/mail/{mail_item_id}/{original_filename}"
