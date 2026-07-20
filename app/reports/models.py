from datetime import date

from sqlalchemy import Date
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.model_mixins import UUIDPrimaryKeyMixin
from app.extensions import db


class ReportSnapshot(db.Model, UUIDPrimaryKeyMixin):
    """One row per day of pre-aggregated counters (cases created/completed,
    revenue), materialized nightly so wide date-range queries don't scan the
    transactional tables. Medians and rates are always computed live -- they
    don't decompose into daily sums."""

    __tablename__ = "report_snapshots"

    snapshot_date: Mapped[date] = mapped_column(Date, unique=True, nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
