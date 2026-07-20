import enum


class InvoiceStatus(str, enum.Enum):
    DRAFT = "draft"
    SENT = "sent"
    PAID = "paid"
    FAILED = "failed"
    REFUNDED = "refunded"


class PaymentStatus(str, enum.Enum):
    INITIALIZED = "initialized"
    SUCCESS = "success"
    FAILED = "failed"
    REFUNDED = "refunded"


class PaymentChannel(str, enum.Enum):
    CARD = "card"
    MOBILE_MONEY = "mobile_money"
    MANUAL = "manual"


class PaymentProviderName(str, enum.Enum):
    PAYSTACK = "paystack"
    MANUAL = "manual"
