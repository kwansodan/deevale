import pytest


@pytest.fixture(autouse=True)
def fake_s3(monkeypatch):
    """No live MinIO in tests -- stub the presign helpers so the documents
    routes can be exercised purely against the DB."""
    monkeypatch.setattr(
        "app.documents.routes.presign_put_url", lambda s3_key, content_type: f"https://fake-s3/{s3_key}?put"
    )
    monkeypatch.setattr("app.documents.routes.presign_get_url", lambda s3_key: f"https://fake-s3/{s3_key}?get")
