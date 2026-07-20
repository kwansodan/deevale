from flask import Flask, jsonify

from app.config import get_config
from app.core.errors import register_error_handlers
from app.core.events.bus import bus
from app.core.events.registry import register_all
from app.extensions import api, cors, db, jwt, limiter, migrate, socketio


def create_app(env_name: str | None = None) -> Flask:
    app = Flask(__name__)
    config_cls = get_config(env_name)
    if hasattr(config_cls, "validate"):
        config_cls.validate()
    app.config.from_object(config_cls)

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    cors.init_app(app, resources={r"/*": {"origins": app.config["CORS_ORIGINS"]}}, supports_credentials=True)
    limiter.init_app(app)
    socketio.init_app(app, message_queue=app.config["REDIS_URL"])
    api.init_app(app)

    register_error_handlers(app)
    _apply_security_headers(app)

    from app.auth.jwt_callbacks import register_jwt_callbacks

    register_jwt_callbacks(jwt)

    from app.notifications.socket_events import register_socket_events

    register_socket_events()

    _register_blueprints(api)

    with app.app_context():
        bus.reset()
        register_all(bus)

    @app.get("/health")
    def health():
        return jsonify({"status": "ok"})

    return app


def _register_blueprints(api) -> None:
    from app.admin.routes import blp as admin_blp
    from app.auth.routes import blp as auth_blp
    from app.billing.routes import blp as billing_blp
    from app.bookkeeping.routes import blp as bookkeeping_blp
    from app.compliance.routes import blp as compliance_blp
    from app.documents.routes import blp as documents_blp
    from app.mailroom.routes import blp as mailroom_blp
    from app.messaging.routes import blp as messaging_blp
    from app.notifications.routes import blp as notifications_blp
    from app.partners.admin_routes import blp as partner_admin_blp
    from app.partners.api_v1 import blp as partner_v1_blp
    from app.payments.routes import blp as payments_blp
    from app.referrals.routes import blp as referrals_blp
    from app.reports.routes import blp as reports_blp
    from app.signatures.routes import blp as signatures_blp
    from app.workflow.routes import blp as workflow_blp

    api.register_blueprint(auth_blp)
    api.register_blueprint(workflow_blp)
    api.register_blueprint(documents_blp)
    api.register_blueprint(payments_blp)
    api.register_blueprint(notifications_blp)
    api.register_blueprint(messaging_blp)
    api.register_blueprint(admin_blp)
    api.register_blueprint(reports_blp)
    api.register_blueprint(compliance_blp)
    api.register_blueprint(billing_blp)
    api.register_blueprint(mailroom_blp)
    api.register_blueprint(bookkeeping_blp)
    api.register_blueprint(signatures_blp)
    api.register_blueprint(partner_admin_blp)
    api.register_blueprint(partner_v1_blp)
    api.register_blueprint(referrals_blp)


def _apply_security_headers(app: Flask) -> None:
    @app.after_request
    def add_security_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        if not app.debug and not app.testing:
            response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
        return response
