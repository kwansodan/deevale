from marshmallow import Schema, fields, validate

from app.bookkeeping.constants import EXPENSE_CATEGORY_CODES, SUPPORTED_CURRENCIES


class BusinessProfileSchema(Schema):
    id = fields.String(dump_only=True)
    business_case_id = fields.String(dump_only=True)
    display_name = fields.String(required=True, validate=validate.Length(min=1, max=255))
    address = fields.String(load_default=None, allow_none=True)
    logo_s3_key = fields.String(dump_only=True, allow_none=True)
    default_currency = fields.String(load_default="GHS", validate=validate.OneOf(SUPPORTED_CURRENCIES))
    is_vat_registered = fields.Boolean(load_default=False)
    vat_rate_bps = fields.Integer(load_default=1500, validate=validate.Range(min=0, max=10_000))
    vat_number = fields.String(load_default=None, allow_none=True)


class LineItemSchema(Schema):
    description = fields.String(required=True, validate=validate.Length(min=1, max=512))
    quantity_milli = fields.Integer(load_default=1000, validate=validate.Range(min=1))
    unit_price_minor = fields.Integer(required=True, validate=validate.Range(min=0))
    amount_minor = fields.Integer(dump_only=True)
    sequence_order = fields.Integer(dump_only=True)


class ClientInvoiceSchema(Schema):
    id = fields.String(dump_only=True)
    invoice_number = fields.String(dump_only=True)
    business_case_id = fields.String(dump_only=True)
    customer_name = fields.String(required=True, validate=validate.Length(min=1, max=255))
    customer_email = fields.Email(load_default=None, allow_none=True)
    currency = fields.String(load_default="GHS", validate=validate.OneOf(SUPPORTED_CURRENCIES))
    status = fields.String(dump_only=True)
    issue_date = fields.Date(load_default=None, allow_none=True)
    due_date = fields.Date(load_default=None, allow_none=True)
    notes = fields.String(load_default=None, allow_none=True)
    vat_rate_bps = fields.Integer(load_default=0, validate=validate.Range(min=0, max=10_000))
    subtotal_minor = fields.Integer(dump_only=True)
    vat_minor = fields.Integer(dump_only=True)
    total_minor = fields.Integer(dump_only=True)
    share_token = fields.String(dump_only=True, allow_none=True)
    sent_at = fields.DateTime(dump_only=True, allow_none=True)
    paid_at = fields.DateTime(dump_only=True, allow_none=True)
    line_items = fields.List(fields.Nested(LineItemSchema), required=True, validate=validate.Length(min=1))


class PublicInvoiceSchema(Schema):
    invoice_number = fields.String(dump_only=True)
    business_name = fields.String(dump_only=True)
    customer_name = fields.String(dump_only=True)
    currency = fields.String(dump_only=True)
    status = fields.String(dump_only=True)
    issue_date = fields.Date(dump_only=True)
    due_date = fields.Date(dump_only=True, allow_none=True)
    subtotal_minor = fields.Integer(dump_only=True)
    vat_minor = fields.Integer(dump_only=True)
    total_minor = fields.Integer(dump_only=True)
    line_items = fields.List(fields.Nested(LineItemSchema), dump_only=True)


class ExpenseSchema(Schema):
    id = fields.String(dump_only=True)
    business_case_id = fields.String(dump_only=True)
    description = fields.String(required=True, validate=validate.Length(min=1, max=512))
    category = fields.String(required=True, validate=validate.OneOf(EXPENSE_CATEGORY_CODES))
    currency = fields.String(load_default="GHS", validate=validate.OneOf(SUPPORTED_CURRENCIES))
    amount_minor = fields.Integer(required=True, validate=validate.Range(min=1))
    expense_date = fields.Date(required=True)
    note = fields.String(load_default=None, allow_none=True)
    receipt_s3_key = fields.String(dump_only=True, allow_none=True)
    has_receipt = fields.Function(lambda obj: obj.receipt_s3_key is not None, dump_only=True)
    created_at = fields.DateTime(dump_only=True)


class ReceiptSlotRequestSchema(Schema):
    original_filename = fields.String(required=True)
    content_type = fields.String(
        required=True, validate=validate.OneOf(["application/pdf", "image/jpeg", "image/png"])
    )
    size_bytes = fields.Integer(required=True, validate=validate.Range(min=1))


class ReceiptSlotResponseSchema(Schema):
    upload_url = fields.String(required=True)
    s3_key = fields.String(required=True)


class CategorySchema(Schema):
    code = fields.String()
    label = fields.String()
