from celery import Celery, Task

from app import create_app


def make_celery() -> Celery:
    flask_app = create_app()

    class FlaskTask(Task):
        def __call__(self, *args, **kwargs):
            with flask_app.app_context():
                return self.run(*args, **kwargs)

    celery_app = Celery(flask_app.name, task_cls=FlaskTask)
    celery_app.config_from_object(flask_app.config["CELERY"])
    celery_app.set_default()
    flask_app.extensions["celery"] = celery_app
    return celery_app


celery_app = make_celery()

# Explicit imports rather than autodiscover: registration then happens at
# import time in every process (worker, beat, tests) instead of lazily at
# worker finalization, so a beat entry can never point at an unregistered task.
import app.bookkeeping.tasks  # noqa: E402,F401
import app.compliance.tasks  # noqa: E402,F401
import app.deadlines.scanner  # noqa: E402,F401
import app.deadlines.sla_scanner  # noqa: E402,F401
import app.documents.tasks  # noqa: E402,F401
import app.mailroom.tasks  # noqa: E402,F401
import app.notifications.tasks  # noqa: E402,F401
import app.partners.tasks  # noqa: E402,F401
import app.payments.tasks  # noqa: E402,F401
import app.reports.tasks  # noqa: E402,F401
import app.signatures.tasks  # noqa: E402,F401
