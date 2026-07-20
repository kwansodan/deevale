"""Business-day arithmetic for SLA timers: Monday-Friday, skipping Ghana
public holidays (admin-editable table)."""

import math
from datetime import date, datetime, timedelta


def is_business_day(day: date, holidays: set[date]) -> bool:
    return day.weekday() < 5 and day not in holidays


def add_business_days(start: datetime, days: int, holidays: set[date]) -> datetime:
    """Returns start + N business days, preserving the time of day. A start
    on a weekend/holiday first rolls forward to the next business day."""
    current = start
    while not is_business_day(current.date(), holidays):
        current += timedelta(days=1)
    remaining = days
    while remaining > 0:
        current += timedelta(days=1)
        if is_business_day(current.date(), holidays):
            remaining -= 1
    return current


def sla_hours_to_business_days(sla_hours: int) -> int:
    return max(math.ceil(sla_hours / 24), 1)


def load_holidays() -> set[date]:
    from app.core.models import PublicHoliday

    return {h.holiday_date for h in PublicHoliday.query.all()}
