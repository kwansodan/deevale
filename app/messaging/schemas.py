from marshmallow import Schema, fields


class CaseMessageSchema(Schema):
    id = fields.String(dump_only=True)
    business_case_id = fields.String(dump_only=True)
    sender_user_id = fields.String(dump_only=True)
    body = fields.String(dump_only=True)
    attachment_document_id = fields.String(dump_only=True, allow_none=True)
    client_read_at = fields.DateTime(dump_only=True, allow_none=True)
    officer_read_at = fields.DateTime(dump_only=True, allow_none=True)
    created_at = fields.DateTime(dump_only=True)


class CreateCaseMessageSchema(Schema):
    body = fields.String(required=True)
    attachment_document_id = fields.String(required=False, allow_none=True)
