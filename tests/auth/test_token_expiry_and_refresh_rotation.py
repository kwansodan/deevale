from datetime import UTC, datetime, timedelta

from freezegun import freeze_time

from tests.helpers import make_user


def test_access_token_expires_after_configured_lifetime(client):
    make_user(email="expiry@example.com", password="supersecret1")
    now = datetime.now(UTC)
    with freeze_time(now):
        login = client.post("/auth/login", json={"email": "expiry@example.com", "password": "supersecret1"})
        headers = {"Authorization": f"Bearer {login.json['access_token']}"}
        assert client.get("/auth/me", headers=headers).status_code == 200

    # TestConfig sets JWT_ACCESS_TOKEN_EXPIRES to 2 seconds.
    with freeze_time(now + timedelta(seconds=5)):
        resp = client.get("/auth/me", headers=headers)
        assert resp.status_code == 401


def test_refresh_rotates_tokens_and_old_refresh_is_blocklisted(client):
    make_user(email="rotate@example.com", password="supersecret1")
    login = client.post("/auth/login", json={"email": "rotate@example.com", "password": "supersecret1"})
    old_refresh = login.json["refresh_token"]

    refresh_headers = {"Authorization": f"Bearer {old_refresh}"}
    refreshed = client.post("/auth/refresh", headers=refresh_headers)
    assert refreshed.status_code == 200
    new_access = refreshed.json["access_token"]
    new_refresh = refreshed.json["refresh_token"]
    assert new_refresh != old_refresh

    # Old refresh token must now be rejected (rotation + blocklist).
    reuse_resp = client.post("/auth/refresh", headers=refresh_headers)
    assert reuse_resp.status_code == 401

    # New access token works.
    me_resp = client.get("/auth/me", headers={"Authorization": f"Bearer {new_access}"})
    assert me_resp.status_code == 200


def test_refresh_token_cannot_be_used_as_access_token(client):
    make_user(email="wrongtype@example.com", password="supersecret1")
    login = client.post("/auth/login", json={"email": "wrongtype@example.com", "password": "supersecret1"})
    refresh_token = login.json["refresh_token"]
    resp = client.get("/auth/me", headers={"Authorization": f"Bearer {refresh_token}"})
    assert resp.status_code == 422 or resp.status_code == 401
