from app.celery_app import celery_app


@celery_app.task(name="app.reports.tasks.materialize_report_snapshot")
def materialize_report_snapshot(day_iso: str | None = None) -> str:
    """Nightly: aggregates yesterday's counters into report_snapshots."""
    from datetime import date, timedelta

    from app.extensions import db
    from app.reports.models import ReportSnapshot
    from app.reports.service import compute_daily_counters

    day = date.fromisoformat(day_iso) if day_iso else date.today() - timedelta(days=1)
    snapshot = ReportSnapshot.query.filter_by(snapshot_date=day).first()
    if snapshot is None:
        snapshot = ReportSnapshot(snapshot_date=day)
        db.session.add(snapshot)
    snapshot.payload = compute_daily_counters(day)
    db.session.commit()
    return day.isoformat()
