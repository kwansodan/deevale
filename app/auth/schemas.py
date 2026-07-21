from marshmallow import Schema, fields, validate

from app.auth.validators import normalize_ghana_phone, normalize_mobile


class GhanaPhoneField(fields.String):
    def _deserialize(self, value, attr, data, **kwargs):
        value = super()._deserialize(value, attr, data, **kwargs)
        return normalize_ghana_phone(value)


class MobileField(fields.String):
    """Any international mobile, normalized to E.164."""

    def _deserialize(self, value, attr, data, **kwargs):
        value = super()._deserialize(value, attr, data, **kwargs)
        return normalize_mobile(value)


class SignupSchema(Schema):
    email = fields.Email(required=True)
    phone = MobileField(required=True)
    secondary_phone = MobileField(load_default=None, allow_none=True)
    is_whatsapp_reachable = fields.Boolean(load_default=False)
    full_name = fields.String(required=True, validate=validate.Length(min=2, max=255))
    password = fields.String(required=True, load_only=True, validate=validate.Length(min=8, max=128))
    referral_code = fields.String(load_default=None, allow_none=True)


class SignupResponseSchema(Schema):
    user_id = fields.String(required=True)
    message = fields.String(required=True)


class OtpVerifySchema(Schema):
    identifier = fields.String(required=True, metadata={"description": "email or phone used at signup"})
    code = fields.String(required=True, validate=validate.Length(equal=6))


class LoginSchema(Schema):
    email = fields.Email(required=True)
    password = fields.String(required=True, load_only=True)


class TokenResponseSchema(Schema):
    access_token = fields.String(required=True)
    refresh_token = fields.String(required=True)


class RefreshResponseSchema(Schema):
    access_token = fields.String(required=True)
    refresh_token = fields.String(required=True)


class MessageResponseSchema(Schema):
    message = fields.String(required=True)


class PasswordResetRequestSchema(Schema):
    email = fields.Email(required=True)


class PasswordResetConfirmSchema(Schema):
    email = fields.Email(required=True)
    code = fields.String(required=True, validate=validate.Length(equal=6))
    new_password = fields.String(required=True, load_only=True, validate=validate.Length(min=8, max=128))


class UserSchema(Schema):
    id = fields.String(dump_only=True)
    email = fields.String(dump_only=True)
    phone = fields.String(dump_only=True)
    secondary_phone = fields.String(dump_only=True, allow_none=True)
    is_whatsapp_reachable = fields.Boolean(dump_only=True)
    full_name = fields.String(dump_only=True)
    roles = fields.Method("get_roles", dump_only=True)
    is_email_verified = fields.Boolean(dump_only=True)
    is_phone_verified = fields.Boolean(dump_only=True)

    def get_roles(self, obj):
        return obj.role_names()
