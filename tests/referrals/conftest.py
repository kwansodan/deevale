import pytest


@pytest.fixture(autouse=True)
def fake_referral_s3(monkeypatch):
    monkeypatch.setattr(
        "app.referrals.routes.presign_put_url",
        lambda s3_key, content_type: f"https://fake-s3/{s3_key}?put",
    )
