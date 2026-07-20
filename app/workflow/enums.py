import enum


class EntityType(str, enum.Enum):
    SOLE_PROPRIETORSHIP = "sole_proprietorship"
    PARTNERSHIP = "partnership"
    COMPANY_LIMITED_BY_SHARES = "company_limited_by_shares"
    COMPANY_LIMITED_BY_GUARANTEE = "company_limited_by_guarantee"
    EXTERNAL_COMPANY = "external_company"


class CaseStatus(str, enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    BLOCKED = "blocked"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class StageStatus(str, enum.Enum):
    LOCKED = "locked"
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    BLOCKED_ON_PAYMENT = "blocked_on_payment"
    COMPLETED = "completed"


class TaskStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    AWAITING_CLIENT = "awaiting_client"
    AWAITING_REVIEW = "awaiting_review"
    DONE = "done"
    SKIPPED = "skipped"
    BLOCKED = "blocked"


class AssigneeType(str, enum.Enum):
    CLIENT = "client"
    STAFF = "staff"


class FeeType(str, enum.Enum):
    GOVERNMENT = "government"
    SERVICE = "service"


class QuoteStatus(str, enum.Enum):
    DRAFT = "draft"
    FINALIZED = "finalized"
    SUPERSEDED = "superseded"


def task_status_display(status: "TaskStatus", assignee_type: "AssigneeType") -> str:
    """Maps internal TaskStatus onto the exact PRD C3 chip vocabulary:
    Not started / Awaiting client / In review / With government / Done / Blocked.
    `in_progress` is ambiguous on its own -- a staff task in progress reads as
    "With government", a client task in progress reads as "Awaiting client".
    """
    if status in (TaskStatus.DONE, TaskStatus.SKIPPED):
        return "Done"
    if status == TaskStatus.BLOCKED:
        return "Blocked"
    if status == TaskStatus.AWAITING_CLIENT:
        return "Awaiting client"
    if status == TaskStatus.AWAITING_REVIEW:
        return "In review"
    if status == TaskStatus.IN_PROGRESS:
        return "With government" if assignee_type == AssigneeType.STAFF else "Awaiting client"
    return "Not started"


STAGE_STATUS_DISPLAY = {
    StageStatus.LOCKED: "Not started",
    StageStatus.NOT_STARTED: "Not started",
    StageStatus.IN_PROGRESS: "With government",
    StageStatus.BLOCKED_ON_PAYMENT: "Blocked",
    StageStatus.COMPLETED: "Done",
}
