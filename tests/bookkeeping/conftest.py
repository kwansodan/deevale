import pytest


@pytest.fixture(autouse=True)
def fake_bookkeeping_s3(monkeypatch):
    monkeypatch.setattr(
        "app.bookkeeping.routes.presign_put_url",
        lambda s3_key, content_type: f"https://fake-s3/{s3_key}?put",
    )
    monkeypatch.setattr(
        "app.bookkeeping.routes.presign_get_url", lambda s3_key: f"https://fake-s3/{s3_key}?get"
    )
