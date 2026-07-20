from unittest.mock import MagicMock

import pytest


@pytest.fixture(autouse=True)
def fake_mail_s3(monkeypatch):
    """No live MinIO in tests -- stub the mailroom presign helpers and the
    storage client the shred task uses to delete objects."""
    monkeypatch.setattr(
        "app.mailroom.routes.presign_put_url",
        lambda s3_key, content_type: f"https://fake-s3/{s3_key}?put",
    )
    monkeypatch.setattr(
        "app.mailroom.routes.presign_get_url", lambda s3_key: f"https://fake-s3/{s3_key}?get"
    )
    monkeypatch.setattr("app.mailroom.storage.get_s3_client", lambda: MagicMock())
