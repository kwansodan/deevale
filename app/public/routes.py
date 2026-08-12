"""Unauthenticated, read-only endpoints for the public marketing site.

These serve content that used to be baked into the frontend bundle at build
time (landing-page prices, statutory thresholds, company trust signals) so a
platform admin can change them at runtime without a redeploy.
"""

from flask_smorest import Blueprint

from app.admin import settings_service
from app.admin.schemas import LandingConfigSchema

blp = Blueprint("public", __name__, url_prefix="/public", description="Public site configuration")


@blp.route("/landing-config", methods=["GET"])
@blp.response(200, LandingConfigSchema)
def landing_config_route():
    """The public landing figures. Unset fields are null and the site degrades
    visibly (see frontend/src/config/landing.ts), never to an invented value."""
    return settings_service.landing_config()
