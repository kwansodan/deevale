from app.celery_app import celery_app
from app.core.events.bus import bus
from app.core.events.events import DeadlineApproaching
from app.core.model_mixins import utcnow
from app.workflow.enums import StageStatus
from app.workflow.models import CaseStage

DEADLINE_WINDOWS_DAYS = (14, 7, 2)
WINDOW_TOLERANCE_HOURS = 12


@celery_app.task(name="app.deadlines.scanner.scan_upcoming_deadlines")
def scan_upcoming_deadlines() -> int:
    """Finds CaseStages (e.g. a Name Reservation nearing its expiry) whose
    deadline_at falls within a T-14/T-7/T-2 day window and emits
    deadline.approaching once per window per stage.

    Runs every 6 hours (see celery_beat_schedule.py); the tolerance window
    keeps it idempotent-ish in practice -- a stage's deadline_at only crosses
    each threshold once, so re-running mid-window won't re-notify because the
    stage's status typically changes (or the deadline passes) well before the
    next scan. A stricter dedup ledger can be added if double-firing is ever
    observed in production.
    """
    now = utcnow()
    emitted = 0

    active_stages = CaseStage.query.filter(
        CaseStage.status.in_([StageStatus.IN_PROGRESS.value, StageStatus.NOT_STARTED.value]),
        CaseStage.deadline_at.isnot(None),
    ).all()

    for stage in active_stages:
        days_remaining = (stage.deadline_at - now).total_seconds() / 86400
        for window in DEADLINE_WINDOWS_DAYS:
            tolerance_days = WINDOW_TOLERANCE_HOURS / 24
            if window - tolerance_days <= days_remaining <= window + tolerance_days:
                bus.dispatch(
                    DeadlineApproaching(
                        case_id=stage.business_case_id,
                        entity_type="case_stage",
                        entity_id=stage.id,
                        days_remaining=window,
                    )
                )
                emitted += 1
                break

    return emitted
