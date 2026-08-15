"""Unauthenticated, read-only endpoints for the public marketing site.

These serve content that used to be baked into the frontend bundle at build
time (landing-page prices, statutory thresholds, company trust signals) so a
platform admin can change them at runtime without a redeploy.
"""

from marshmallow import Schema, fields
from flask_smorest import Blueprint

from app.admin import settings_service
from app.admin.schemas import LandingConfigSchema
from app.public.exchange import get_rates

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
