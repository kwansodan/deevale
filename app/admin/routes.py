import uuid

from flask_smorest import Blueprint

from app.admin.schemas import (
    FeeScheduleItemSchema,
    FeeScheduleItemUpdateSchema,
    NotificationTemplateSchema,
    OfficerWorkloadSchema,
    PublicHolidaySchema,
)
from app.core.audit import write_audit_log
from app.core.current_user import get_current_user
from app.core.enums import RoleName
from app.core.errors import ConflictError, NotFoundError
from app.core.rbac import require_roles
from app.extensions import db
from app.notifications.copy import NOTIFICATION_COPY
from app.notifications.models import NotificationTemplate
from app.workflow.models import FeeScheduleItem

blp = Blueprint("admin", __name__, url_prefix="/admin", description="Admin: fee schedule and templates")


# --- Fee schedule ------------------------------------------------------------


@blp.route("/fee-schedule", methods=["GET"])
@require_roles(RoleName.ADMIN, RoleName.FINANCE)
@blp.response(200, FeeScheduleItemSchema(many=True))
def list_fee_schedule_route():
    return FeeScheduleItem.query.order_by(FeeScheduleItem.fee_type, FeeScheduleItem.code).all()


@blp.route("/fee-schedule", methods=["POST"])
@require_roles(RoleName.ADMIN, RoleName.FINANCE)
@blp.arguments(FeeScheduleItemSchema)
@blp.response(201, FeeScheduleItemSchema)
def create_fee_schedule_item_route(payload):
    user = get_current_user()
    if FeeScheduleItem.query.filter_by(code=payload["code"]).first() is not None:
        raise ConflictError(f"A fee schedule item with code '{payload['code']}' already exists")

    item = FeeScheduleItem(**payload)
    db.session.add(item)
    write_audit_log(
        action="fee_schedule_item_created",
        actor_user_id=user.id,
        entity_type="fee_schedule_item",
        entity_id=item.id,
        context={"code": item.code, "amount_minor": item.amount_minor},
    )
    db.session.commit()
    return item


@blp.route("/fee-schedule/<string:item_id>", methods=["PUT"])
@require_roles(RoleName.ADMIN, RoleName.FINANCE)
@blp.arguments(FeeScheduleItemUpdateSchema)
@blp.response(200, FeeScheduleItemSchema)
def update_fee_schedule_item_route(payload, item_id):
    user = get_current_user()
    try:
        item = FeeScheduleItem.query.get(uuid.UUID(item_id))
    except ValueError:
        raise NotFoundError("Fee schedule item not found") from None
    if item is None:
        raise NotFoundError("Fee schedule item not found")

    changes = {}
    for field in ("label", "amount_minor", "is_active"):
        if field in payload:
            changes[field] = {"from": getattr(item, field), "to": payload[field]}
            setattr(item, field, payload[field])

    write_audit_log(
        action="fee_schedule_item_updated",
        actor_user_id=user.id,
        entity_type="fee_schedule_item",
        entity_id=item.id,
        context={"code": item.code, "changes": changes},
    )
    db.session.commit()
    return item


# --- Public holidays (SLA business-day calendar) -----------------------------


@blp.route("/holidays", methods=["GET"])
@require_roles(RoleName.ADMIN, RoleName.CASE_OFFICER, RoleName.FINANCE)
@blp.response(200, PublicHolidaySchema(many=True))
def list_holidays_route():
    from app.core.models import PublicHoliday

    return PublicHoliday.query.order_by(PublicHoliday.holiday_date).all()


@blp.route("/holidays", methods=["POST"])
@require_roles(RoleName.ADMIN)
@blp.arguments(PublicHolidaySchema)
@blp.response(201, PublicHolidaySchema)
def create_holiday_route(payload):
    from app.core.models import PublicHoliday

    if PublicHoliday.query.filter_by(holiday_date=payload["holiday_date"]).first() is not None:
        raise ConflictError("A holiday already exists on that date")
    holiday = PublicHoliday(**payload)
    db.session.add(holiday)
    db.session.commit()
    return holiday


@blp.route("/holidays/<string:holiday_id>", methods=["DELETE"])
@require_roles(RoleName.ADMIN)
@blp.response(200)
def delete_holiday_route(holiday_id):
    from app.core.models import PublicHoliday

    try:
        holiday = PublicHoliday.query.get(uuid.UUID(holiday_id))
    except ValueError:
        raise NotFoundError("Holiday not found") from None
    if holiday is None:
        raise NotFoundError("Holiday not found")
    db.session.delete(holiday)
    db.session.commit()
    return {"message": "deleted"}


# --- Officer workload ---------------------------------------------------------


@blp.route("/officer-workload", methods=["GET"])
@require_roles(RoleName.ADMIN)
@blp.response(200, OfficerWorkloadSchema(many=True))
def officer_workload_route():
    from app.auth.models import User
    from app.workflow.models import BusinessCase, CaseStage, CaseTask

    officers = (
        User.query.join(User.roles).filter_by(name=RoleName.CASE_OFFICER.value).distinct().all()
    )
    open_statuses = ("pending", "in_progress", "awaiting_client", "awaiting_review")
    result = []
    for officer in officers:
        open_cases = BusinessCase.query.filter(
            BusinessCase.assigned_officer_id == officer.id,
            BusinessCase.status.in_(["active", "blocked"]),
        ).all()
        case_ids = [c.id for c in open_cases]
        open_tasks = 0
        breached_tasks = 0
        if case_ids:
            tasks = (
                CaseTask.query.join(CaseStage, CaseTask.case_stage_id == CaseStage.id)
                .filter(CaseStage.business_case_id.in_(case_ids), CaseTask.status.in_(open_statuses))
                .all()
            )
            open_tasks = len(tasks)
            breached_tasks = sum(1 for t in tasks if t.sla_breached_at is not None)
        result.append(
            {
                "officer_id": str(officer.id),
                "officer_name": officer.full_name,
                "open_cases": len(open_cases),
                "open_tasks": open_tasks,
                "breached_tasks": breached_tasks,
                "breach_rate": round(breached_tasks / open_tasks, 3) if open_tasks else 0.0,
            }
        )
    return result


# --- Notification templates ----------------------------------------------------


@blp.route("/notification-templates", methods=["GET"])
@require_roles(RoleName.ADMIN)
@blp.response(200, NotificationTemplateSchema(many=True))
def list_notification_templates_route():
    """Every category with its effective template -- DB override where one
    exists, code default otherwise (is_override tells them apart)."""
    overrides = {t.category: t for t in NotificationTemplate.query.all()}
    result = []
    for category, copy_pair in NOTIFICATION_COPY.items():
        override = overrides.get(category)
        if override is not None:
            result.append(
                {
                    "id": str(override.id),
                    "category": category,
                    "title_template": override.title_template,
                    "body_template": override.body_template,
                    "updated_at": override.updated_at,
                    "is_override": True,
                }
            )
        else:
            result.append(
                {
                    "id": None,
                    "category": category,
                    "title_template": copy_pair["title"],
                    "body_template": copy_pair["body"],
                    "updated_at": None,
                    "is_override": False,
                }
            )
    return result


@blp.route("/notification-templates", methods=["PUT"])
@require_roles(RoleName.ADMIN)
@blp.arguments(NotificationTemplateSchema)
@blp.response(200, NotificationTemplateSchema)
def upsert_notification_template_route(payload):
    user = get_current_user()
    template = NotificationTemplate.query.filter_by(category=payload["category"]).first()
    if template is None:
        template = NotificationTemplate(category=payload["category"])
        db.session.add(template)
    template.title_template = payload["title_template"]
    template.body_template = payload["body_template"]

    write_audit_log(
        action="notification_template_updated",
        actor_user_id=user.id,
        entity_type="notification_template",
        entity_id=template.id,
        context={"category": payload["category"]},
    )
    db.session.commit()
    return {
        "id": str(template.id),
        "category": template.category,
        "title_template": template.title_template,
        "body_template": template.body_template,
        "updated_at": template.updated_at,
        "is_override": True,
    }


@blp.route("/notification-templates/<string:category>", methods=["DELETE"])
@require_roles(RoleName.ADMIN)
@blp.response(200)
def reset_notification_template_route(category):
    """Removes the override so the code default applies again."""
    user = get_current_user()
    template = NotificationTemplate.query.filter_by(category=category).first()
    if template is None:
        raise NotFoundError("No override exists for this category")
    db.session.delete(template)
    write_audit_log(
        action="notification_template_reset",
        actor_user_id=user.id,
        entity_type="notification_template",
        entity_id=template.id,
        context={"category": category},
    )
    db.session.commit()
    return {"message": "reset"}
