from marshmallow import Schema, fields


class InvoiceLineItemSchema(Schema):
    id = fields.String(dump_only=True)
    label = fields.String(dump_only=True)
    amount_minor = fields.Integer(dump_only=True)
    fee_type = fields.String(dump_only=True)


class InvoiceSchema(Schema):
    id = fields.String(dump_only=True)
    business_case_id = fields.String(dump_only=True)
    invoice_number = fields.String(dump_only=True)
    status = fields.String(dump_only=True)
    subtotal_government_minor = fields.Integer(dump_only=True)
    subtotal_service_minor = fields.Integer(dump_only=True)
    total_minor = fields.Integer(dump_only=True)
    currency = fields.String(dump_only=True)
    receipt_s3_key = fields.String(dump_only=True, allow_none=True)
    sent_at = fields.DateTime(dump_only=True, allow_none=True)
    paid_at = fields.DateTime(dump_only=True, allow_none=True)
    line_items = fields.List(fields.Nested(InvoiceLineItemSchema), dump_only=True)


class InitializeTransactionResponseSchema(Schema):
    authorization_url = fields.String(required=True)
    provider_reference = fields.String(required=True)


class PaymentSchema(Schema):
    id = fields.String(dump_only=True)
    invoice_id = fields.String(dump_only=True)
    provider = fields.String(dump_only=True)
    provider_reference = fields.String(dump_only=True, allow_none=True)
    channel = fields.String(dump_only=True)
    amount_minor = fields.Integer(dump_only=True)
    currency = fields.String(dump_only=True)
    status = fields.String(dump_only=True)
    is_manual_credit = fields.Boolean(dump_only=True)
    note = fields.String(dump_only=True, allow_none=True)
    paid_at = fields.DateTime(dump_only=True, allow_none=True)
    created_at = fields.DateTime(dump_only=True)


class ManualCreditRequestSchema(Schema):
    amount_minor = fields.Integer(required=True)
    note = fields.String(required=False, allow_none=True)


class RefundLogRequestSchema(Schema):
    amount_minor = fields.Integer(required=True)
    note = fields.String(required=False, allow_none=True)


class WebhookAckSchema(Schema):
    message = fields.String(required=True)
