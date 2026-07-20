from marshmallow import Schema, fields, validate


class SignatureTemplateSchema(Schema):
    id = fields.String(dump_only=True)
    name = fields.String(required=True, validate=validate.Length(min=1, max=255))
    body_html = fields.String(required=True, validate=validate.Length(min=1))
    merge_fields = fields.List(fields.String(), load_default=list)


class PartyInputSchema(Schema):
    name = fields.String(required=True, validate=validate.Length(min=1, max=255))
    email = fields.Email(required=True)


class CreateSignatureRequestSchema(Schema):
    business_case_id = fields.String(required=True)
    case_task_id = fields.String(load_default=None, allow_none=True)
    template_id = fields.String(load_default=None, allow_none=True)
    title = fields.String(required=True, validate=validate.Length(min=1, max=255))
    body_html = fields.String(load_default=None, allow_none=True)
    merge_values = fields.Dict(load_default=dict)
    parties = fields.List(fields.Nested(PartyInputSchema), required=True, validate=validate.Length(min=1))


class SignaturePartySchema(Schema):
    id = fields.String(dump_only=True)
    name = fields.String(dump_only=True)
    email = fields.String(dump_only=True)
    order_index = fields.Integer(dump_only=True)
    status = fields.String(dump_only=True)
    sign_token = fields.String(dump_only=True)
    signature_type = fields.String(dump_only=True, allow_none=True)
    signed_at = fields.DateTime(dump_only=True, allow_none=True)


class SignatureRequestSchema(Schema):
    id = fields.String(dump_only=True)
    business_case_id = fields.String(dump_only=True)
    case_task_id = fields.String(dump_only=True, allow_none=True)
    title = fields.String(dump_only=True)
    provider = fields.String(dump_only=True)
    status = fields.String(dump_only=True)
    sent_at = fields.DateTime(dump_only=True, allow_none=True)
    completed_at = fields.DateTime(dump_only=True, allow_none=True)
    parties = fields.List(fields.Nested(SignaturePartySchema), dump_only=True)


class PublicSigningViewSchema(Schema):
    title = fields.String(dump_only=True)
    merged_html = fields.String(dump_only=True)
    party_name = fields.String(dump_only=True)
    status = fields.String(dump_only=True)
    can_sign = fields.Boolean(dump_only=True)
    already_signed = fields.Boolean(dump_only=True)


class SubmitSignatureSchema(Schema):
    signature_type = fields.String(required=True, validate=validate.OneOf(["drawn", "typed"]))
    signature_data = fields.String(required=True, validate=validate.Length(min=1))
