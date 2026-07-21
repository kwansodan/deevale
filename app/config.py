import os
from datetime import timedelta


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-me")

    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL", "postgresql+psycopg2://deevalegh:deevalegh@localhost:5432/deevalegh"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "dev-jwt-secret-change-me")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=15)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)
    JWT_TOKEN_LOCATION = ["headers"]

    CELERY = {
        "broker_url": os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/1"),
        "result_backend": os.environ.get("CELERY_RESULT_BACKEND", "redis://localhost:6379/1"),
        "task_always_eager": False,
    }

    S3_ENDPOINT_URL = os.environ.get("S3_ENDPOINT_URL", "http://localhost:9000")
    S3_ACCESS_KEY = os.environ.get("S3_ACCESS_KEY", "deevalegh")
    S3_SECRET_KEY = os.environ.get("S3_SECRET_KEY", "deevalegh-secret")
    S3_BUCKET = os.environ.get("S3_BUCKET", "deevalegh-documents")
    S3_REGION = os.environ.get("S3_REGION", "us-east-1")
    S3_USE_SSL = os.environ.get("S3_USE_SSL", "false").lower() == "true"
    S3_PUBLIC_ENDPOINT_URL = os.environ.get("S3_PUBLIC_ENDPOINT_URL", S3_ENDPOINT_URL)

    MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024
    ALLOWED_UPLOAD_CONTENT_TYPES = {"application/pdf", "image/jpeg", "image/png"}

    # Deevale GH registered-office address, assigned to clients on the
    # registered-address add-on. Editable per deployment.
    REGISTERED_OFFICE_ADDRESS = os.environ.get(
        "REGISTERED_OFFICE_ADDRESS",
        "Deevale GH Ltd, 3rd Floor, Atlantic Tower, Airport City, Accra, Ghana",
    )
    # How long scanned mail is retained before the shred job removes the scan.
    MAIL_RETENTION_DAYS = int(os.environ.get("MAIL_RETENTION_DAYS", "90"))

    # console = log the code (dev); live = send via EMAIL_SENDER / SMS_SENDER.
    OTP_SENDER = os.environ.get("OTP_SENDER", "console")
    EMAIL_SENDER = os.environ.get("EMAIL_SENDER", "console")  # console | resend
    RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
    EMAIL_FROM_ADDRESS = os.environ.get("EMAIL_FROM_ADDRESS", "notifications@deevalegh.com")

    SMS_SENDER = os.environ.get("SMS_SENDER", "console")  # console | twilio | hubtel
    # Alphanumeric sender IDs are capped at 11 chars and reject spaces, so this
    # stays a single token rather than matching the display name exactly.
    SMS_SENDER_ID = os.environ.get("SMS_SENDER_ID", "DeevaleGH")
    SMS_DEFAULT_COST_MINOR = int(os.environ.get("SMS_DEFAULT_COST_MINOR", "5"))
    TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
    TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "")
    HUBTEL_CLIENT_ID = os.environ.get("HUBTEL_CLIENT_ID", "")
    HUBTEL_CLIENT_SECRET = os.environ.get("HUBTEL_CLIENT_SECRET", "")
    WHATSAPP_SENDER = os.environ.get("WHATSAPP_SENDER", "console")
    WHATSAPP_PHONE_NUMBER_ID = os.environ.get("WHATSAPP_PHONE_NUMBER_ID", "")
    WHATSAPP_ACCESS_TOKEN = os.environ.get("WHATSAPP_ACCESS_TOKEN", "")
    # Ghana quiet hours for SMS (Africa/Accra is UTC year-round).
    SMS_QUIET_HOURS_START = 21
    SMS_QUIET_HOURS_END = 7

    # Compliance subscription plans (Paystack plan codes + display prices).
    SUBSCRIPTION_MONTHLY_PLAN_CODE = os.environ.get("SUBSCRIPTION_MONTHLY_PLAN_CODE", "PLN_monthly_dev")
    SUBSCRIPTION_ANNUAL_PLAN_CODE = os.environ.get("SUBSCRIPTION_ANNUAL_PLAN_CODE", "PLN_annual_dev")
    SUBSCRIPTION_MONTHLY_PRICE_MINOR = int(os.environ.get("SUBSCRIPTION_MONTHLY_PRICE_MINOR", "9900"))
    SUBSCRIPTION_ANNUAL_PRICE_MINOR = int(os.environ.get("SUBSCRIPTION_ANNUAL_PRICE_MINOR", "99900"))

    # Referral rewards (pesewas): granted to the referrer when their referee's
    # first Deevale GH invoice is paid, plus a welcome credit for the referee.
    REFERRAL_REWARD_MINOR = int(os.environ.get("REFERRAL_REWARD_MINOR", "5000"))
    REFERRAL_WELCOME_MINOR = int(os.environ.get("REFERRAL_WELCOME_MINOR", "2500"))

    SIGNATURE_PROVIDER = os.environ.get("SIGNATURE_PROVIDER", "builtin")  # builtin | dropbox_sign
    DROPBOX_SIGN_API_KEY = os.environ.get("DROPBOX_SIGN_API_KEY", "")

    PAYMENT_PROVIDER = os.environ.get("PAYMENT_PROVIDER", "paystack")
    PAYSTACK_SECRET_KEY = os.environ.get("PAYSTACK_SECRET_KEY", "sk_test_placeholder")
    PAYSTACK_PUBLIC_KEY = os.environ.get("PAYSTACK_PUBLIC_KEY", "pk_test_placeholder")
    PAYSTACK_BASE_URL = os.environ.get("PAYSTACK_BASE_URL", "https://api.paystack.co")

    CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",")

    API_TITLE = "Deevale GH API"
    API_VERSION = "v1"
    OPENAPI_VERSION = "3.0.3"
    OPENAPI_URL_PREFIX = "/"
    OPENAPI_SWAGGER_UI_PATH = "/docs"
    OPENAPI_SWAGGER_UI_URL = "https://cdn.jsdelivr.net/npm/swagger-ui-dist/"

    RATELIMIT_STORAGE_URI = os.environ.get("RATELIMIT_STORAGE_URI", REDIS_URL)

    MAX_CONTENT_LENGTH = 12 * 1024 * 1024


class DevConfig(Config):
    DEBUG = True


class TestConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "TEST_DATABASE_URL", "postgresql+psycopg2://deevalegh:deevalegh@localhost:5432/deevalegh_test"
    )
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(seconds=2)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(seconds=10)
    CELERY = {**Config.CELERY, "task_always_eager": True}
    RATELIMIT_ENABLED = False


class ProdConfig(Config):
    DEBUG = False

    @classmethod
    def validate(cls) -> None:
        """Refuses to boot production with dev-default secrets."""
        insecure = {
            "SECRET_KEY": "dev-secret-change-me",
            "JWT_SECRET_KEY": "dev-jwt-secret-change-me",
            "PAYSTACK_SECRET_KEY": "sk_test_placeholder",
        }
        problems = [name for name, default in insecure.items() if getattr(cls, name) == default]
        if problems:
            raise RuntimeError(
                f"Refusing to start in production with default secrets: {', '.join(problems)}. "
                "Set them via environment variables."
            )


CONFIG_MAP = {
    "development": DevConfig,
    "testing": TestConfig,
    "production": ProdConfig,
}


def get_config(env_name: str | None = None):
    env_name = env_name or os.environ.get("FLASK_ENV", "development")
    return CONFIG_MAP.get(env_name, DevConfig)
