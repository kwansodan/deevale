from marshmallow import INCLUDE, Schema, fields, validate

from app.notifications.enums import NotificationCategory
from app.workflow.enums import FeeType


class ReferralSettingsSchema(Schema):
    # Reward to the referrer and welcome credit to the referred user, in pesewas.
    reward_minor = fields.Integer(required=True, validate=validate.Range(min=0))
    welcome_minor = fields.Integer(required=True, validate=validate.Range(min=0))


class LandingConfigSchema(Schema):
    # The landing figures are a nested, entirely-optional blob; the service owns
    # the shape and fills defaults. Each section is declared as a passthrough dict
    # so it survives BOTH load and dump -- a fieldless schema would serialize to
    # {} on dump (marshmallow's `unknown` only applies to load), which blanks the
    # admin form and the public landing config. `unknown = INCLUDE` keeps any
    # future section the service adds without a schema change.
    company = fields.Dict(load_default=dict)
    pricing = fields.Dict(load_default=dict)
    prices = fields.Dict(load_default=dict)
    timelines = fields.Dict(load_default=dict)
    gipc = fields.Dict(load_default=dict)
    compliance = fields.Dict(load_default=dict)
    legal = fields.Dict(load_default=dict)
    # Real social proof. Lists of loosely-typed dicts (the frontend owns the item
    # shape); rating is a small flat dict. Declared -- like the sections above --
    # so they survive dump (a fieldless schema serializes to {}).
    testimonials = fields.List(fields.Dict(), load_default=list)
    logos = fields.List(fields.Dict(), load_default=list)
    rating = fields.Dict(load_default=dict)

    class Meta:
        unknown = INCLUDE


class FeeScheduleItemSchema(Schema):
    id = fields.String(dump_only=True)
    code = fields.String(required=True, validate=validate.Length(min=2, max=64))
    label = fields.String(required=True, validate=validate.Length(min=2, max=255))
    applies_to_entity_type = fields.String(load_default=None, allow_none=True)
    applies_to_stage_code = fields.String(load_default=None, allow_none=True)
    amount_minor = fields.Integer(required=True, validate=validate.Range(min=0))
    currency = fields.String(load_default="GHS")
    fee_type = fields.String(required=True, validate=validate.OneOf([f.value for f in FeeType]))
    is_active = fields.Boolean(load_default=True)
    effective_from = fields.DateTime(dump_only=True)
    effective_to = fields.DateTime(dump_only=True, allow_none=True)


class FeeScheduleItemUpdateSchema(Schema):
    label = fields.String(validate=validate.Length(min=2, max=255))
    amount_minor = fields.Integer(validate=validate.Range(min=0))
    is_active = fields.Boolean()


class PublicHolidaySchema(Schema):
    id = fields.String(dump_only=True)
    holiday_date = fields.Date(required=True)
    name = fields.String(required=True, validate=validate.Length(min=2, max=128))


class OfficerWorkloadSchema(Schema):
    officer_id = fields.String(dump_only=True)
    officer_name = fields.String(dump_only=True)
    open_cases = fields.Integer(dump_only=True)
    open_tasks = fields.Integer(dump_only=True)
    breached_tasks = fields.Integer(dump_only=True)
    breach_rate = fields.Float(dump_only=True)


class NotificationTemplateSchema(Schema):
    id = fields.String(dump_only=True)
    category = fields.String(
        required=True, validate=validate.OneOf([c.value for c in NotificationCategory])
    )
    title_template = fields.String(required=True, validate=validate.Length(min=1, max=255))
    body_template = fields.String(required=True, validate=validate.Length(min=1))
    updated_at = fields.DateTime(dump_only=True)
    is_override = fields.Boolean(dump_only=True, load_default=None)
