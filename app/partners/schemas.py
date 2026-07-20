from marshmallow import INCLUDE, Schema, fields, validate

PARTNER_EVENT_TYPES = [
    "case.created",
    "stage.completed",
    "document.approved",
    "document.rejected",
    "payment.received",
    "case.blocked",
]

API_SCOPES = ["cases:read", "cases:write", "documents:write", "webhooks:manage"]


# --- Partner API (key-authed) ------------------------------------------------


class PartnerClientSchema(Schema):
    full_name = fields.String(required=True, validate=validate.Length(min=2, max=255))
    email = fields.Email(required=True)
    phone = fields.String(required=True)


class PartnerCreateCaseSchema(Schema):
    class Meta:
        unknown = INCLUDE  # extra onboarding fields pass through to the payload

    client = fields.Nested(PartnerClientSchema, required=True)
    entity_type = fields.String(required=True)
    business_name = fields.String(load_default=None, allow_none=True)


class PartnerCaseSummarySchema(Schema):
    id = fields.String(dump_only=True)
    case_number = fields.String(dump_only=True)
    entity_type = fields.String(dump_only=True)
    status = fields.String(dump_only=True)
    created_at = fields.DateTime(dump_only=True)


class PartnerWebhookCreateSchema(Schema):
    url = fields.Url(required=True, require_tld=False)
    event_types = fields.List(
        fields.String(validate=validate.OneOf(PARTNER_EVENT_TYPES)), required=True, validate=validate.Length(min=1)
    )


class PartnerWebhookSchema(Schema):
    id = fields.String(dump_only=True)
    url = fields.String(dump_only=True)
    event_types = fields.List(fields.String(), dump_only=True)
    is_active = fields.Boolean(dump_only=True)
    secret = fields.String(dump_only=True)  # returned once at creation


class PartnerWebhookListSchema(Schema):
    """Webhook view without the signing secret, for list endpoints."""

    id = fields.String(dump_only=True)
    url = fields.String(dump_only=True)
    event_types = fields.List(fields.String(), dump_only=True)
    is_active = fields.Boolean(dump_only=True)


class PartnerDocumentSlotSchema(Schema):
    document_type_code = fields.String(required=True)
    original_filename = fields.String(required=True)
    content_type = fields.String(required=True)
    size_bytes = fields.Integer(required=True)


# --- Admin management --------------------------------------------------------


class PartnerSchema(Schema):
    id = fields.String(dump_only=True)
    name = fields.String(required=True, validate=validate.Length(min=1, max=255))
    slug = fields.String(required=True, validate=validate.Length(min=1, max=64))
    contact_email = fields.Email(load_default=None, allow_none=True)
    logo_url = fields.String(load_default=None, allow_none=True)
    accent_color = fields.String(load_default="#14532D")
    status = fields.String(dump_only=True)
    rate_limit_per_hour = fields.Integer(load_default=1000)
    created_at = fields.DateTime(dump_only=True)


class CreateApiKeySchema(Schema):
    name = fields.String(required=True, validate=validate.Length(min=1, max=128))
    scopes = fields.List(fields.String(validate=validate.OneOf(API_SCOPES)), required=True)


class ApiKeyCreatedSchema(Schema):
    id = fields.String(dump_only=True)
    name = fields.String(dump_only=True)
    prefix = fields.String(dump_only=True)
    scopes = fields.List(fields.String(), dump_only=True)
    plaintext_key = fields.String(dump_only=True)  # shown once


class ApiKeySchema(Schema):
    id = fields.String(dump_only=True)
    name = fields.String(dump_only=True)
    prefix = fields.String(dump_only=True)
    scopes = fields.List(fields.String(), dump_only=True)
    is_active = fields.Boolean(dump_only=True)
    last_used_at = fields.DateTime(dump_only=True, allow_none=True)
    created_at = fields.DateTime(dump_only=True)
