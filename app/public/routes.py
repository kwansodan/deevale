"""Unauthenticated, read-only endpoints for the public marketing site.

These serve content that used to be baked into the frontend bundle at build
time (landing-page prices, statutory thresholds, company trust signals) so a
platform admin can change them at runtime without a redeploy.
"""

from flask_smorest import Blueprint
from marshmallow import Schema, fields

from app.admin import settings_service
from app.admin.schemas import LandingConfigSchema
from app.public.exchange import get_rates
from app.workflow.schemas import QuotePreviewRequestSchema, QuotePreviewResponseSchema

blp = Blueprint("public", __name__, url_prefix="/public", description="Public site configuration")


class ExchangeRatesSchema(Schema):
    base = fields.String()
    rates = fields.Dict(keys=fields.String(), values=fields.Float())
    fetched_at = fields.Integer()


@blp.route("/landing-config", methods=["GET"])
@blp.response(200, LandingConfigSchema)
def landing_config_route():
    """The public landing figures. Unset fields are null and the site degrades
    visibly (see frontend/src/config/landing.ts), never to an invented value."""
    return settings_service.landing_config()


@blp.route("/exchange-rates", methods=["GET"])
@blp.response(200, ExchangeRatesSchema)
def exchange_rates_route():
    """USD-based rates for the landing page's indicative currency display."""
    return get_rates()


@blp.route("/quote-preview", methods=["GET"])
@blp.arguments(QuotePreviewRequestSchema, location="query")
@blp.response(200, QuotePreviewResponseSchema)
def public_quote_preview_route(args):
    """Public, unauthenticated itemized fee quote calculation for prospective clients and SEO calculators."""
    from app.workflow.quote_service import preview_quote

    return preview_quote(args["entity_type"], args.get("foreign_participation", False))


class LeadInquirySchema(Schema):
    full_name = fields.String(required=True)
    phone = fields.String(required=True)
    email = fields.String(allow_none=True)
    business_name = fields.String(allow_none=True)
    service = fields.String(required=True)
    details = fields.String(allow_none=True)


class LeadInquiryResponseSchema(Schema):
    ok = fields.Boolean()
    message = fields.String()


@blp.route("/leads", methods=["POST"])
@blp.arguments(LeadInquirySchema)
@blp.response(200, LeadInquiryResponseSchema)
def public_lead_inquiry_route(data):
    """Public sales inquiry endpoint that dispatches immediate lead notifications."""
    import logging
    from flask import current_app

    logger = logging.getLogger("deevalegh.leads")
    logger.info("New lead captured: %s (%s) for %s", data["full_name"], data["phone"], data["service"])

    try:
        from app.notifications.channels.email import get_email_sender

        sender = get_email_sender()
        admin_email = (
            current_app.config.get("ADMIN_NOTIFICATION_EMAIL")
            or current_app.config.get("EMAIL_FROM_ADDRESS")
            or "support@deevalegh.com"
        )
        subject = f"🔥 New Client Lead: {data['full_name']} ({data.get('business_name') or 'New Venture'})"
        plain_body = f"""New sales lead submitted on deevalegh.com:

Full Name: {data['full_name']}
WhatsApp/Phone: {data['phone']}
Email: {data.get('email') or 'Not provided'}
Business Name: {data.get('business_name') or 'Not provided'}
Service Requested: {data['service']}
Notes / Situation: {data.get('details') or 'None'}

Direct WhatsApp: https://wa.me/{data['phone'].replace('+', '').replace(' ', '')}
"""
        html_body = f"""<h3>New Sales Lead on deevalegh.com</h3>
<p><strong>Full Name:</strong> {data['full_name']}</p>
<p><strong>WhatsApp / Phone:</strong> <a href="https://wa.me/{data['phone'].replace('+', '').replace(' ', '')}">{data['phone']}</a></p>
<p><strong>Email:</strong> {data.get('email') or 'Not provided'}</p>
<p><strong>Business Name:</strong> {data.get('business_name') or 'Not provided'}</p>
<p><strong>Service Requested:</strong> {data['service']}</p>
<p><strong>Notes:</strong> {data.get('details') or 'None'}</p>
<hr>
<p><a href="https://wa.me/{data['phone'].replace('+', '').replace(' ', '')}" style="background:#25D366;color:white;padding:10px 18px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:bold;">Chat on WhatsApp with Lead</a></p>
"""
        sender.send(admin_email, subject, html_body, plain_body)
    except Exception as exc:
        logger.warning("Failed to dispatch lead email notification: %s", exc)

    return {"ok": True, "message": "Inquiry received"}


