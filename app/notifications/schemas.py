from marshmallow import Schema, fields


class NotificationSchema(Schema):
    id = fields.String(dump_only=True)
    category = fields.String(dump_only=True)
    title = fields.String(dump_only=True)
    body = fields.String(dump_only=True)
    related_case_id = fields.String(dump_only=True, allow_none=True)
    is_read = fields.Boolean(dump_only=True)
    read_at = fields.DateTime(dump_only=True, allow_none=True)
    created_at = fields.DateTime(dump_only=True)


class UnreadCountSchema(Schema):
    count = fields.Integer(required=True)


class NotificationPreferenceSchema(Schema):
    category = fields.String(required=True)
    email_enabled = fields.Boolean(required=True)
    in_app_enabled = fields.Boolean(required=True)
    sms_enabled = fields.Boolean(load_default=None, allow_none=True)
    whatsapp_enabled = fields.Boolean(load_default=None, allow_none=True)


class UpdatePreferencesRequestSchema(Schema):
    preferences = fields.List(fields.Nested(NotificationPreferenceSchema), required=True)
