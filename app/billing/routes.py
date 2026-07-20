import uuid
from datetime import timedelta

import requests
from flask import current_app, request
from flask_jwt_extended import jwt_required
from flask_smorest import Blueprint
from marshmallow import Schema, fields, validate

from app.billing.models import Subscription, has_active_subscription
from app.core.current_user import get_current_user
from app.core.enums import RoleName
from app.core.errors import ValidationAppError
from app.core.model_mixins import utcnow
from app.core.rbac import require_roles
from app.extensions import db

blp = Blueprint("billing", __name__, url_prefix="/billing", description="Compliance subscription billing")


class SubscriptionSchema(Schema):
    id = fields.String(dump_only=True)
    plan = fields.String(dump_only=True)
    status = fields.String(dump_only=True)
    current_period_end = fields.DateTime(dump_only=True, allow_none=True)
    created_at = fields.DateTime(dump_only=True)


class SubscribeRequestSchema(Schema):
    plan = fields.String(required=True, validate=validate.OneOf(["monthly", "annual"]))


class SubscriptionStatusSchema(Schema):
    active = fields.Boolean(required=True)
    subscription = fields.Nested(SubscriptionSchema, allow_none=True)
    monthly_price_minor = fields.Integer(required=True)
    annual_price_minor = fields.Integer(required=True)


@blp.route("/subscription", methods=["GET"])
@jwt_required()
@blp.response(200, SubscriptionStatusSchema)
def my_subscription_route():
    user = get_current_user()
    subscription = (
        Subscription.query.filter_by(user_id=user.id)
        .order_by(Subscription.created_at.desc())
        .first()
    )
    return {
        "active": has_active_subscription(user.id),
        "subscription": subscription,
        "monthly_price_minor": current_app.config["SUBSCRIPTION_MONTHLY_PRICE_MINOR"],
        "annual_price_minor": current_app.config["SUBSCRIPTION_ANNUAL_PRICE_MINOR"],
    }


@blp.route("/subscribe", methods=["POST"])
@jwt_required()
@blp.arguments(SubscribeRequestSchema)
@blp.response(200)
def subscribe_route(payload):
    """Initializes a Paystack plan checkout; activation happens when the
    charge.success webhook (carrying our reference) arrives."""
    user = get_current_user()
    plan = payload["plan"]
    if has_active_subscription(user.id):
        raise ValidationAppError("You already have an active subscription")

    plan_code = (
        current_app.config["SUBSCRIPTION_MONTHLY_PLAN_CODE"]
        if plan == "monthly"
        else current_app.config["SUBSCRIPTION_ANNUAL_PLAN_CODE"]
    )
    amount = (
        current_app.config["SUBSCRIPTION_MONTHLY_PRICE_MINOR"]
        if plan == "monthly"
        else current_app.config["SUBSCRIPTION_ANNUAL_PRICE_MINOR"]
    )

    subscription = Subscription(id=uuid.uuid4(), user_id=user.id, plan=plan, status="pending")
    reference = f"SUB-{subscription.id}"
    subscription.provider_reference = reference
    db.session.add(subscription)
    db.session.commit()

    callback_url = request.args.get("callback_url", "")
    response = requests.post(
        f"{current_app.config['PAYSTACK_BASE_URL']}/transaction/initialize",
        headers={"Authorization": f"Bearer {current_app.config['PAYSTACK_SECRET_KEY']}"},
        json={
            "email": user.email,
            "amount": amount,
            "currency": "GHS",
            "reference": reference,
            "plan": plan_code,
            "callback_url": callback_url,
        },
        timeout=15,
    )
    response.raise_for_status()
    data = response.json()["data"]
    return {"authorization_url": data["authorization_url"], "reference": reference}


def activate_subscription_by_reference(reference: str) -> bool:
    """Called from the Paystack webhook when a charge.success carries one of
    our SUB- references."""
    subscription = Subscription.query.filter_by(provider_reference=reference).first()
    if subscription is None:
        return False
    subscription.status = "active"
    period = timedelta(days=365 if subscription.plan == "annual" else 30)
    subscription.current_period_end = utcnow() + period
    db.session.flush()
    return True


def handle_subscription_failure(reference: str) -> bool:
    """Failed renewal -> past_due + dunning notification."""
    subscription = Subscription.query.filter_by(provider_reference=reference).first()
    if subscription is None:
        return False
    subscription.status = "past_due"
    db.session.flush()

    from app.auth.models import User
    from app.notifications.dispatcher import dispatcher
    from app.notifications.enums import NotificationCategory

    user = User.query.get(subscription.user_id)
    if user is not None:
        dispatcher.notify(
            user,
            NotificationCategory.PAYMENT_DUE,
            {
                "business_name": "your compliance plan",
                "invoice_number": reference,
                "amount": f"{(current_app.config['SUBSCRIPTION_MONTHLY_PRICE_MINOR'] if subscription.plan == 'monthly' else current_app.config['SUBSCRIPTION_ANNUAL_PRICE_MINOR']) / 100:.2f}",
            },
        )
    return True


@blp.route("/finance/metrics", methods=["GET"])
@require_roles(RoleName.FINANCE, RoleName.ADMIN)
@blp.response(200)
def finance_metrics_route():
    from datetime import timedelta as td

    monthly_price = current_app.config["SUBSCRIPTION_MONTHLY_PRICE_MINOR"]
    annual_price = current_app.config["SUBSCRIPTION_ANNUAL_PRICE_MINOR"]

    active = Subscription.query.filter_by(status="active").all()
    active_monthly = sum(1 for s in active if s.plan == "monthly")
    active_annual = sum(1 for s in active if s.plan == "annual")
    mrr_minor = active_monthly * monthly_price + round(active_annual * annual_price / 12)

    thirty_days_ago = utcnow() - td(days=30)
    churned_30d = Subscription.query.filter(
        Subscription.status.in_(["cancelled", "past_due"]),
        Subscription.updated_at >= thirty_days_ago,
    ).count()
    denominator = len(active) + churned_30d

    return {
        "active_subscriptions": len(active),
        "active_monthly": active_monthly,
        "active_annual": active_annual,
        "mrr_minor": mrr_minor,
        "churned_last_30d": churned_30d,
        "churn_rate_30d": round(churned_30d / denominator, 3) if denominator else 0.0,
    }
