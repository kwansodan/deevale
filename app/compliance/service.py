"""Obligation generation matrix.

Rules (v1, editable as regulations move):
- ORC annual return: every registered entity, due on the first anniversary of
  case completion; external companies file the equivalent branch return.
- Financial statements: companies (shares/guarantee/external), due 30 April of
  the following year (calendar fiscal year assumed for v1).
- Corporate income tax: companies and partnerships, due 30 April next year.
- VAT return: monthly, only when the onboarding payload says vat_registered.
- PAYE remittance: monthly, only when planned_employees > 0.
- Business Operating Permit renewal: annual, due 31 January next year (MMDAs
  bill at the start of the year).
"""

from datetime import date, timedelta

from app.compliance.models import ComplianceObligation
from app.extensions import db
from app.workflow.models import BusinessCase

MONTHLY_HORIZON = 6  # how many upcoming monthly occurrences to materialize

COMPANY_TYPES = {"company_limited_by_shares", "company_limited_by_guarantee", "external_company"}


def _add_years(d: date, years: int) -> date:
    try:
        return d.replace(year=d.year + years)
    except ValueError:  # 29 Feb
        return d.replace(year=d.year + years, day=28)


def _next_month_end(d: date, offset: int) -> date:
    month = d.month + offset
    year = d.year + (month - 1) // 12
    month = (month - 1) % 12 + 1
    if month == 12:
        return date(year, 12, 31)
    return date(year, month + 1, 1) - timedelta(days=1)


def generate_obligations(case: BusinessCase) -> list[ComplianceObligation]:
    """Called once when a case completes. Idempotent: skips if obligations
    already exist for the case."""
    if ComplianceObligation.query.filter_by(business_case_id=case.id).count() > 0:
        return []

    completion = date.today()
    payload = case.onboarding_payload or {}
    entity = case.entity_type
    business_name = payload.get("business_name", case.case_number)

    obligations: list[dict] = []

    annual_return_title = (
        "Branch annual return (ORC)" if entity == "external_company" else "ORC annual return"
    )
    obligations.append(
        dict(
            code="orc_annual_return",
            title=annual_return_title,
            description=f"Annual return for {business_name} — due each year on your registration anniversary.",
            due_date=_add_years(completion, 1),
            recurrence="annual",
        )
    )

    if entity in COMPANY_TYPES:
        obligations.append(
            dict(
                code="financial_statements",
                title="File financial statements",
                description="Audited financial statements for the previous financial year.",
                due_date=date(completion.year + 1, 4, 30),
                recurrence="annual",
            )
        )

    if entity in COMPANY_TYPES or entity == "partnership":
        obligations.append(
            dict(
                code="corporate_income_tax",
                title="Corporate income tax return (GRA)",
                description="Annual income tax return — due four months after your financial year end.",
                due_date=date(completion.year + 1, 4, 30),
                recurrence="annual",
            )
        )

    if payload.get("vat_registered"):
        for offset in range(1, MONTHLY_HORIZON + 1):
            obligations.append(
                dict(
                    code="vat_return",
                    title="VAT return (GRA)",
                    description="Monthly VAT return — due by the last working day of the following month.",
                    due_date=_next_month_end(completion, offset),
                    recurrence="monthly",
                )
            )

    if int(payload.get("planned_employees") or 0) > 0:
        for offset in range(1, MONTHLY_HORIZON + 1):
            obligations.append(
                dict(
                    code="paye_remittance",
                    title="PAYE & SSNIT remittance",
                    description="Monthly employee tax and pension contributions.",
                    due_date=_next_month_end(completion, offset),
                    recurrence="monthly",
                )
            )

    obligations.append(
        dict(
            code="bop_renewal",
            title="Business Operating Permit renewal (MMDA)",
            description="Your district assembly operating permit renews annually.",
            due_date=date(completion.year + 1, 1, 31),
            recurrence="annual",
        )
    )

    rows = [
        ComplianceObligation(business_case_id=case.id, client_id=case.client_id, **data)
        for data in obligations
    ]
    db.session.add_all(rows)
    db.session.flush()
    return rows


REMINDER_MARKS = (30, 14, 7, 2)


def scan_obligation_reminders() -> int:
    """T-30/14/7/2 reminders through the existing notification engine."""
    from app.auth.models import User
    from app.notifications.dispatcher import dispatcher
    from app.notifications.enums import NotificationCategory

    today = date.today()
    emitted = 0
    upcoming = ComplianceObligation.query.filter(
        ComplianceObligation.status == "upcoming",
        ComplianceObligation.due_date >= today,
        ComplianceObligation.due_date <= today + timedelta(days=max(REMINDER_MARKS)),
    ).all()

    for obligation in upcoming:
        days_left = (obligation.due_date - today).days
        mark = next((m for m in REMINDER_MARKS if days_left <= m), None)
        if mark is None or mark in (obligation.reminded_marks or []):
            continue
        user = User.query.get(obligation.client_id)
        if user is None:
            continue
        case = BusinessCase.query.get(obligation.business_case_id)
        dispatcher.notify(
            user,
            NotificationCategory.DEADLINE_COUNTDOWN,
            {
                "business_name": (case.onboarding_payload or {}).get("business_name", case.case_number),
                "days_remaining": days_left,
                "entity_label": obligation.title,
            },
            related_case_id=obligation.business_case_id,
        )
        obligation.reminded_marks = [*(obligation.reminded_marks or []), mark]
        emitted += 1

    db.session.commit()
    return emitted
