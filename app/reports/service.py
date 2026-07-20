import statistics
from datetime import UTC, date, datetime, time, timedelta

from app.documents.models import DocumentVersion
from app.payments.models import Invoice
from app.reports.models import ReportSnapshot
from app.workflow.models import BusinessCase, CaseStage, CaseTask

# Ranges wider than this use nightly snapshots for the daily counters.
LIVE_RANGE_LIMIT_DAYS = 31


def _day_bounds(day: date) -> tuple[datetime, datetime]:
    start = datetime.combine(day, time.min, tzinfo=UTC)
    return start, start + timedelta(days=1)


def compute_daily_counters(day: date) -> dict:
    """The snapshot payload for one day -- everything here must be summable
    across days."""
    start, end = _day_bounds(day)

    created = BusinessCase.query.filter(
        BusinessCase.created_at >= start, BusinessCase.created_at < end
    ).count()
    completed = BusinessCase.query.filter(
        BusinessCase.status == "completed",
        BusinessCase.updated_at >= start,
        BusinessCase.updated_at < end,
    ).count()

    paid_invoices = Invoice.query.filter(
        Invoice.status.in_(["paid", "refunded"]), Invoice.paid_at >= start, Invoice.paid_at < end
    ).all()
    revenue_service = sum(i.subtotal_service_minor for i in paid_invoices)
    revenue_government = sum(i.subtotal_government_minor for i in paid_invoices)

    return {
        "cases_created": created,
        "cases_completed": completed,
        "revenue_service_minor": revenue_service,
        "revenue_government_minor": revenue_government,
    }


def _daily_series(date_from: date, date_to: date) -> list[dict]:
    """Per-day counters over the range: snapshots where they exist, live
    computation for missing days (typically just today)."""
    snapshots = {
        s.snapshot_date: s.payload
        for s in ReportSnapshot.query.filter(
            ReportSnapshot.snapshot_date >= date_from, ReportSnapshot.snapshot_date <= date_to
        ).all()
    }
    span = (date_to - date_from).days
    use_live_fill = span <= LIVE_RANGE_LIMIT_DAYS

    series = []
    day = date_from
    while day <= date_to:
        payload = snapshots.get(day)
        if payload is None and (use_live_fill or day >= date.today()):
            payload = compute_daily_counters(day)
        if payload is None:
            payload = {
                "cases_created": 0,
                "cases_completed": 0,
                "revenue_service_minor": 0,
                "revenue_government_minor": 0,
            }
        series.append({"date": day.isoformat(), **payload})
        day += timedelta(days=1)
    return series


def _median_days(deltas: list[timedelta]) -> float | None:
    if not deltas:
        return None
    return round(statistics.median(d.total_seconds() for d in deltas) / 86400, 1)


def compute_kpis(date_from: date, date_to: date) -> dict:
    start = datetime.combine(date_from, time.min, tzinfo=UTC)
    end = datetime.combine(date_to, time.max, tzinfo=UTC)

    series = _daily_series(date_from, date_to)
    cases_created = sum(d["cases_created"] for d in series)
    cases_completed = sum(d["cases_completed"] for d in series)
    revenue_service = sum(d["revenue_service_minor"] for d in series)
    revenue_government = sum(d["revenue_government_minor"] for d in series)

    # Median cycle time: cases completed in range.
    completed_cases = BusinessCase.query.filter(
        BusinessCase.status == "completed",
        BusinessCase.updated_at >= start,
        BusinessCase.updated_at <= end,
    ).all()
    overall_cycle_days = _median_days([c.updated_at - c.created_at for c in completed_cases])

    # Median cycle per stage: stages completed in range.
    stage_rows = CaseStage.query.filter(
        CaseStage.completed_at.isnot(None),
        CaseStage.started_at.isnot(None),
        CaseStage.completed_at >= start,
        CaseStage.completed_at <= end,
    ).all()
    per_stage: dict[str, list[timedelta]] = {}
    stage_names: dict[str, str] = {}
    for row in stage_rows:
        per_stage.setdefault(row.code, []).append(row.completed_at - row.started_at)
        stage_names[row.code] = row.name
    cycle_per_stage = [
        {"stage_code": code, "stage_name": stage_names[code], "median_days": _median_days(deltas)}
        for code, deltas in sorted(per_stage.items())
    ]

    # First-pass approval: version-1 reviews decided in range.
    first_versions = DocumentVersion.query.filter(
        DocumentVersion.version_number == 1,
        DocumentVersion.reviewed_at.isnot(None),
        DocumentVersion.reviewed_at >= start,
        DocumentVersion.reviewed_at <= end,
    ).all()
    reviewed = len(first_versions)
    approved_first_pass = sum(1 for v in first_versions if v.review_status == "approved")

    # Rejection reasons across all versions in range.
    rejected_versions = DocumentVersion.query.filter(
        DocumentVersion.review_status == "rejected",
        DocumentVersion.reviewed_at >= start,
        DocumentVersion.reviewed_at <= end,
    ).all()
    reasons: dict[str, int] = {}
    for v in rejected_versions:
        key = v.review_reason_code or "unspecified"
        reasons[key] = reasons.get(key, 0) + 1
    rejection_reasons = [
        {"reason": reason, "count": count} for reason, count in sorted(reasons.items(), key=lambda x: -x[1])
    ]

    # SLA breach rate: tasks whose SLA clock ran (due date in range).
    sla_tasks = CaseTask.query.filter(
        CaseTask.sla_due_at.isnot(None), CaseTask.sla_due_at >= start, CaseTask.sla_due_at <= end
    ).all()
    sla_total = len(sla_tasks)
    sla_breached = sum(1 for t in sla_tasks if t.sla_breached_at is not None)

    subscription_conversions = _subscription_conversions(start, end)

    return {
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "cases_created": cases_created,
        "cases_completed": cases_completed,
        "median_cycle_days": overall_cycle_days,
        "cycle_per_stage": cycle_per_stage,
        "first_pass_reviewed": reviewed,
        "first_pass_approval_rate": round(approved_first_pass / reviewed, 3) if reviewed else None,
        "rejection_reasons": rejection_reasons,
        "revenue_service_minor": revenue_service,
        "revenue_government_minor": revenue_government,
        "sla_tasks": sla_total,
        "sla_breach_rate": round(sla_breached / sla_total, 3) if sla_total else None,
        "subscription_conversions": subscription_conversions,
        "daily_series": series,
    }


def _subscription_conversions(start: datetime, end: datetime) -> int:
    """Subscriptions activated in range. Returns 0 until the subscription
    module (2.6) is present."""
    try:
        from app.billing.models import Subscription
    except ImportError:
        return 0
    return Subscription.query.filter(
        Subscription.status == "active",
        Subscription.created_at >= start,
        Subscription.created_at <= end,
    ).count()
