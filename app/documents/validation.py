from flask import current_app

from app.core.errors import ValidationAppError


def validate_upload_request(content_type: str, size_bytes: int) -> None:
    allowed = current_app.config["ALLOWED_UPLOAD_CONTENT_TYPES"]
    if content_type not in allowed:
        raise ValidationAppError(f"Unsupported content type '{content_type}'. Allowed: PDF, JPG, PNG.")

    max_size = current_app.config["MAX_UPLOAD_SIZE_BYTES"]
    if size_bytes > max_size:
        raise ValidationAppError(f"File exceeds the {max_size // (1024 * 1024)} MB size limit.")

    if size_bytes <= 0:
        raise ValidationAppError("File size must be greater than zero.")
