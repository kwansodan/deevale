import csv
import io
from datetime import date, timedelta

from flask import Response
from flask_smorest import Blueprint
from marshmallow import Schema, fields

from app.core.enums import RoleName
from app.core.errors import ValidationAppError
from app.core.rbac import require_roles
from app.reports.service import compute_kpis

blp = Blueprint("reports", __name__, url_prefix="/reports", description="KPI reporting (admin + finance)")


class ReportRangeQuerySchema(Schema):
    date_from = fields.Date(load_default=None)
    date_to = fields.Date(load_default=None)


def _resolve_range(params) -> tuple[date, date]:
    date_to = params.get("date_to") or date.today()
    date_from = params.get("date_from") or (date_to - timedelta(days=29))
    if date_from > date_to:
        raise ValidationAppError("date_from must be on or before date_to")
    if (date_to - date_from).days > 730:
        raise ValidationAppError("Date range cannot exceed two years")
    return date_from, date_to


@blp.route("/kpis", methods=["GET"])
@require_roles(RoleName.ADMIN, RoleName.FINANCE)
@blp.arguments(ReportRangeQuerySchema, location="query")
@blp.response(200)
def kpis_route(params):
    date_from, date_to = _resolve_range(params)
    return compute_kpis(date_from, date_to)


def _csv_response(filename: str, header: list[str], rows: list[list]) -> Response:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(header)
    writer.writerows(rows)
    return Response(
        buffer.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@blp.route("/export/cases.csv", methods=["GET"])
@require_roles(RoleName.ADMIN, RoleName.FINANCE)
@blp.arguments(ReportRangeQuerySchema, location="query")
def export_cases_route(params):
    date_from, date_to = _resolve_range(params)
    kpis = compute_kpis(date_from, date_to)
    rows = [
        [d["date"], d["cases_created"], d["cases_completed"]] for d in kpis["daily_series"]
    ]
    return _csv_response("cases.csv", ["date", "cases_created", "cases_completed"], rows)


@blp.route("/export/revenue.csv", methods=["GET"])
@require_roles(RoleName.ADMIN, RoleName.FINANCE)
@blp.arguments(ReportRangeQuerySchema, location="query")
def export_revenue_route(params):
    date_from, date_to = _resolve_range(params)
    kpis = compute_kpis(date_from, date_to)
    rows = [
        [d["date"], d["revenue_service_minor"] / 100, d["revenue_government_minor"] / 100]
        for d in kpis["daily_series"]
    ]
    return _csv_response("revenue.csv", ["date", "service_fees_ghs", "government_passthrough_ghs"], rows)


@blp.route("/export/rejections.csv", methods=["GET"])
@require_roles(RoleName.ADMIN, RoleName.FINANCE)
@blp.arguments(ReportRangeQuerySchema, location="query")
def export_rejections_route(params):
    date_from, date_to = _resolve_range(params)
    kpis = compute_kpis(date_from, date_to)
    rows = [[r["reason"], r["count"]] for r in kpis["rejection_reasons"]]
    return _csv_response("rejections.csv", ["reason", "count"], rows)


@blp.route("/export/cycle-times.csv", methods=["GET"])
@require_roles(RoleName.ADMIN, RoleName.FINANCE)
@blp.arguments(ReportRangeQuerySchema, location="query")
def export_cycle_times_route(params):
    date_from, date_to = _resolve_range(params)
    kpis = compute_kpis(date_from, date_to)
    rows = [[s["stage_name"], s["median_days"]] for s in kpis["cycle_per_stage"]]
    return _csv_response("cycle-times.csv", ["stage", "median_days"], rows)
