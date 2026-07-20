from marshmallow import Schema, fields, validate


class DisclaimerSchema(Schema):
    office_address = fields.String(dump_only=True)
    disclaimer = fields.String(dump_only=True)
    subscription_required = fields.Boolean(dump_only=True)
    enrolled = fields.Boolean(dump_only=True)


class EnrollRequestSchema(Schema):
    business_case_id = fields.String(required=True)
    consent = fields.Boolean(required=True, validate=validate.Equal(True))


class EnrollmentSchema(Schema):
    id = fields.String(dump_only=True)
    business_case_id = fields.String(dump_only=True)
    office_address = fields.String(dump_only=True)
    consent_text = fields.String(dump_only=True)
    consented_at = fields.DateTime(dump_only=True)
    status = fields.String(dump_only=True)


class LogMailRequestSchema(Schema):
    business_case_id = fields.String(required=True)
    sender = fields.String(required=True, validate=validate.Length(min=1, max=255))
    subject = fields.String(load_default=None, allow_none=True)
    received_date = fields.Date(required=True)
    urgency = fields.String(load_default="normal", validate=validate.OneOf(["normal", "urgent"]))


class MailScanSlotRequestSchema(Schema):
    original_filename = fields.String(required=True)
    content_type = fields.String(required=True, validate=validate.Equal("application/pdf"))
    size_bytes = fields.Integer(required=True, validate=validate.Range(min=1))


class MailScanSlotResponseSchema(Schema):
    upload_url = fields.String(required=True)
    s3_key = fields.String(required=True)


class MailItemSchema(Schema):
    id = fields.String(dump_only=True)
    business_case_id = fields.String(dump_only=True)
    client_id = fields.String(dump_only=True)
    sender = fields.String(dump_only=True)
    subject = fields.String(dump_only=True, allow_none=True)
    received_date = fields.Date(dump_only=True)
    urgency = fields.String(dump_only=True)
    status = fields.String(dump_only=True)
    read_at = fields.DateTime(dump_only=True, allow_none=True)
    shred_after = fields.Date(dump_only=True, allow_none=True)
    created_at = fields.DateTime(dump_only=True)
    has_scan = fields.Function(lambda obj: obj.scan_s3_key is not None, dump_only=True)


class MailDownloadUrlSchema(Schema):
    download_url = fields.String(required=True)
    expires_in = fields.Integer(required=True)


class ForwardRequestSchema(Schema):
    forwarding_address = fields.String(required=True, validate=validate.Length(min=5))


class ForwardRequestResponseSchema(Schema):
    id = fields.String(dump_only=True)
    mail_item_id = fields.String(dump_only=True)
    forwarding_address = fields.String(dump_only=True)
    status = fields.String(dump_only=True)
    created_at = fields.DateTime(dump_only=True)


class ForwardRequestTransitionSchema(Schema):
    status = fields.String(required=True, validate=validate.OneOf(["in_progress", "done"]))
