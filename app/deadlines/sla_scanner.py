from datetime import timedelta

from app.celery_app import celery_app

ESCALATION_AFTER_HOURS = 24


@celery_app.task(name="app.deadlines.sla_scanner.scan_sla_breaches")
def scan_sla_breaches() -> dict:
    """Hourly: flags tasks past their SLA due time, alerts the case's officer,
    and escalates to the officer's supervisor after 24h unresolved."""
    from app.auth.models import User
    from app.core.model_mixins import utcnow
    from app.extensions import db
    from app.notifications.dispatcher import dispatcher
    from app.notifications.enums import NotificationCategory
    from app.workflow.models import BusinessCase, CaseStage, CaseTask

    now = utcnow()
    open_statuses = ("pending", "in_progress", "awaiting_client", "awaiting_review")

    newly_breached = 0
    escalated = 0

    overdue = (
        CaseTask.query.filter(
            CaseTask.sla_due_at.isnot(None),
            CaseTask.sla_due_at < now,
            CaseTask.status.in_(open_statuses),
            CaseTask.sla_breached_at.is_(None),
        )
        .all()
    )
    for task in overdue:
        task.sla_breached_at = now
        newly_breached += 1

        case = BusinessCase.query.get(
            CaseStage.query.get(task.case_stage_id).business_case_id
        )
        recipients = []
        if case.assigned_officer_id:
            officer = User.query.get(case.assigned_officer_id)
            if officer:
                recipients.append(officer)
        if not recipients:
            from app.core.enums import RoleName

            recipients = User.query.filter(User.roles.any(name=RoleName.CASE_OFFICER.value)).all()
        for recipient in recipients:
            dispatcher.notify(
                recipient,
                NotificationCategory.STAFF_SLA_BREACH,
                {"case_number": case.case_number, "task_name": task.name},
                related_case_id=case.id,
            )

    # Escalation: breached > 24h, still open, not yet escalated.
    stale = (
        CaseTask.query.filter(
            CaseTask.sla_breached_at.isnot(None),
            CaseTask.sla_breached_at < now - timedelta(hours=ESCALATION_AFTER_HOURS),
            CaseTask.status.in_(open_statuses),
            CaseTask.escalated_at.is_(None),
        )
        .all()
    )
    for task in stale:
        case = BusinessCase.query.get(
            CaseStage.query.get(task.case_stage_id).business_case_id
        )
        officer = User.query.get(case.assigned_officer_id) if case.assigned_officer_id else None
        supervisor = User.query.get(officer.supervisor_id) if officer and officer.supervisor_id else None
        if supervisor is None:
            continue  # re-checked next run in case a supervisor gets assigned
        task.escalated_at = now
        escalated += 1
        dispatcher.notify(
            supervisor,
            NotificationCategory.STAFF_SLA_BREACH,
            {
                "case_number": case.case_number,
                "task_name": f"ESCALATION — {task.name} (unresolved {ESCALATION_AFTER_HOURS}h after breach)",
            },
            related_case_id=case.id,
        )

    db.session.commit()
    return {"breached": newly_breached, "escalated": escalated}
