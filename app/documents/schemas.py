from marshmallow import Schema, fields, validate


class UploadSlotRequestSchema(Schema):
    business_case_id = fields.String(required=True)
    document_id = fields.String(required=False, allow_none=True)
    case_task_id = fields.String(required=False, allow_none=True)
    document_type_code = fields.String(required=True)
    original_filename = fields.String(required=True)
    content_type = fields.String(required=True)
    size_bytes = fields.Integer(required=True)


class UploadSlotResponseSchema(Schema):
    document_id = fields.String(required=True)
    version_id = fields.String(required=True)
    version_number = fields.Integer(required=True)
    upload_url = fields.String(required=True)
    s3_key = fields.String(required=True)


class DocumentVersionSchema(Schema):
    id = fields.String(dump_only=True)
    version_number = fields.Integer(dump_only=True)
    original_filename = fields.String(dump_only=True)
    content_type = fields.String(dump_only=True)
    size_bytes = fields.Integer(dump_only=True, allow_none=True)
    upload_status = fields.String(dump_only=True)
    review_status = fields.String(dump_only=True)
    review_reason_code = fields.String(dump_only=True, allow_none=True)
    review_note = fields.String(dump_only=True, allow_none=True)
    reviewed_by_user_id = fields.String(dump_only=True, allow_none=True)
    reviewed_at = fields.DateTime(dump_only=True, allow_none=True)
    virus_scan_status = fields.String(dump_only=True)
    uploaded_at = fields.DateTime(dump_only=True, allow_none=True)
    created_at = fields.DateTime(dump_only=True)


class DocumentSchema(Schema):
    id = fields.String(dump_only=True)
    business_case_id = fields.String(dump_only=True)
    case_task_id = fields.String(dump_only=True, allow_none=True)
    document_type_code = fields.String(dump_only=True)
    uploaded_by_user_id = fields.String(dump_only=True)
    is_vault = fields.Boolean(dump_only=True)
    current_version_number = fields.Integer(dump_only=True)
    created_at = fields.DateTime(dump_only=True)
    versions = fields.List(fields.Nested(DocumentVersionSchema), dump_only=True)


class DownloadUrlResponseSchema(Schema):
    download_url = fields.String(required=True)
    expires_in = fields.Integer(required=True)


class ReviewRequestSchema(Schema):
    decision = fields.String(required=True, validate=validate.OneOf(["approve", "reject"]))
    reason_code = fields.String(required=False, allow_none=True)
    note = fields.String(required=False, allow_none=True)
