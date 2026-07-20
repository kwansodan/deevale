import enum


class NotificationCategory(str, enum.Enum):
    STAGE_COMPLETED = "stage_completed"
    ACTION_REQUIRED = "action_required"
    DOCUMENT_REJECTED = "document_rejected"
    PAYMENT_DUE = "payment_due"
    PAYMENT_RECEIVED = "payment_received"
    GOV_PROCESSING_UPDATE = "gov_processing_update"
    DEADLINE_COUNTDOWN = "deadline_countdown"
    CASE_BLOCKED = "case_blocked"
    STAFF_NEW_UPLOAD = "staff_new_upload"
    STAFF_SLA_BREACH = "staff_sla_breach"
    STAFF_PAYMENT_RECEIVED = "staff_payment_received"
    # Meta-category: opt-in flag for the Sunday digest email; never dispatched
    # through the event bus.
    WEEKLY_DIGEST = "weekly_digest"


CLIENT_CATEGORIES = {
    NotificationCategory.STAGE_COMPLETED,
    NotificationCategory.ACTION_REQUIRED,
    NotificationCategory.DOCUMENT_REJECTED,
    NotificationCategory.PAYMENT_DUE,
    NotificationCategory.PAYMENT_RECEIVED,
    NotificationCategory.GOV_PROCESSING_UPDATE,
    NotificationCategory.DEADLINE_COUNTDOWN,
    NotificationCategory.CASE_BLOCKED,
}

STAFF_CATEGORIES = {
    NotificationCategory.STAFF_NEW_UPLOAD,
    NotificationCategory.STAFF_SLA_BREACH,
    NotificationCategory.STAFF_PAYMENT_RECEIVED,
}


class DeliveryChannel(str, enum.Enum):
    IN_APP = "in_app"
    EMAIL = "email"
    SMS = "sms"
    WHATSAPP = "whatsapp"


class DeliveryStatus(str, enum.Enum):
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"
    RETRYING = "retrying"
    ABANDONED = "abandoned"
    # SMS held for Ghana quiet hours (21:00-07:00), flushed by beat job.
    QUEUED = "queued"
