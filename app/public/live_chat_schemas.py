from marshmallow import Schema, fields


class LiveChatMessageSchema(Schema):
    id = fields.String(dump_only=True)
    session_id = fields.String(dump_only=True)
    sender_type = fields.String(dump_only=True)
    sender_user_id = fields.String(dump_only=True, allow_none=True)
    sender_name = fields.String(dump_only=True, allow_none=True)
    body = fields.String(required=True)
    read_at = fields.String(dump_only=True, allow_none=True)
    created_at = fields.String(dump_only=True)


class LiveChatSessionSchema(Schema):
    id = fields.String(dump_only=True)
    visitor_id = fields.String(required=True)
    visitor_name = fields.String(allow_none=True)
    visitor_email = fields.String(allow_none=True)
    visitor_phone = fields.String(allow_none=True)
    current_page = fields.String()
    referrer = fields.String(allow_none=True)
    user_agent = fields.String(allow_none=True)
    ip_address = fields.String(allow_none=True)
    status = fields.String()
    is_online = fields.Boolean()
    last_seen_at = fields.String(allow_none=True)
    assigned_officer_id = fields.String(allow_none=True)
    assigned_officer_name = fields.String(allow_none=True)
    created_at = fields.String()
    updated_at = fields.String()
    unread_count = fields.Integer(dump_only=True)
    messages = fields.List(fields.Nested(LiveChatMessageSchema), dump_only=True)
    last_message = fields.Nested(LiveChatMessageSchema, dump_only=True, allow_none=True)


class LiveChatSessionInitSchema(Schema):
    visitor_id = fields.String(required=True)
    page = fields.String(load_default="/")
    referrer = fields.String(load_default=None, allow_none=True)
    user_agent = fields.String(load_default=None, allow_none=True)


class LiveChatContactUpdateSchema(Schema):
    visitor_name = fields.String(load_default=None, allow_none=True)
    visitor_email = fields.String(load_default=None, allow_none=True)
    visitor_phone = fields.String(load_default=None, allow_none=True)


class LiveChatMessageCreateSchema(Schema):
    body = fields.String(required=True)
    sender_name = fields.String(load_default=None, allow_none=True)
