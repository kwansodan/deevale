import os

os.environ.setdefault("FLASK_ENV", "testing")

import pytest

from app import create_app
from app.extensions import db as _db


@pytest.fixture(scope="session")
def app():
    application = create_app("testing")
    with application.app_context():
        _db.create_all()
        yield application
        _db.session.remove()
        _db.drop_all()


@pytest.fixture(scope="session")
def client(app):
    return app.test_client()


@pytest.fixture(autouse=True)
def db_session(app):
    """Truncates every table after each test so tests don't leak state into
    each other, while still sharing one app/DB for the whole session (avoids
    re-registering event bus handlers per test -- see app/core/events/bus.py).
    Simple truncate-after is used instead of SAVEPOINT rollback because the
    latter is fragile against Flask-SQLAlchemy's per-request scoped session
    reattaching to the engine's default connection.
    """
    with app.app_context():
        yield _db.session
        _db.session.remove()
        with _db.engine.begin() as connection:
            for table in reversed(_db.metadata.sorted_tables):
                connection.execute(table.delete())
