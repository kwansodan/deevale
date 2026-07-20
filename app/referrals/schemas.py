from marshmallow import Schema, fields, validate


class ReferralCreditSchema(Schema):
    id = fields.String(dump_only=True)
    amount_minor = fields.Integer(dump_only=True)
    currency = fields.String(dump_only=True)
    source = fields.String(dump_only=True)
    status = fields.String(dump_only=True)
    created_at = fields.DateTime(dump_only=True)


class ReferralMeSchema(Schema):
    code = fields.String(dump_only=True)
    share_url = fields.String(dump_only=True)
    available_balance_minor = fields.Integer(dump_only=True)
    currency = fields.String(dump_only=True)
    credits = fields.List(fields.Nested(ReferralCreditSchema), dump_only=True)


class CoFounderInviteCreateSchema(Schema):
    invitee_name = fields.String(required=True, validate=validate.Length(min=2, max=255))
    invitee_email = fields.Email(required=True)
    role = fields.String(load_default="director")


class CoFounderInviteSchema(Schema):
    id = fields.String(dump_only=True)
    business_case_id = fields.String(dump_only=True)
    invitee_name = fields.String(dump_only=True)
    invitee_email = fields.String(dump_only=True)
    role = fields.String(dump_only=True)
    status = fields.String(dump_only=True)
    created_at = fields.DateTime(dump_only=True)


class PublicInviteSchema(Schema):
    invitee_name = fields.String(dump_only=True)
    inviter_name = fields.String(dump_only=True)
    business_name = fields.String(dump_only=True)
    role = fields.String(dump_only=True)
    status = fields.String(dump_only=True)


class KycSlotRequestSchema(Schema):
    original_filename = fields.String(required=True)
    content_type = fields.String(required=True)
    size_bytes = fields.Integer(required=True)
    document_type_code = fields.String(load_default="ghana_card")


class KycSlotResponseSchema(Schema):
    document_id = fields.String(required=True)
    upload_url = fields.String(required=True)
    s3_key = fields.String(required=True)
