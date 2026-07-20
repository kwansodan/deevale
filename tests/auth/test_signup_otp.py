import re

CODE_RE = re.compile(r"code is (\d{6})")


def _extract_code(caplog) -> str:
    for record in caplog.records:
        m = CODE_RE.search(record.getMessage())
        if m:
            return m.group(1)
    raise AssertionError("No OTP code found in logs")


def test_signup_sends_console_otp_and_creates_unverified_user(client, caplog):
    with caplog.at_level("INFO", logger="launchgh.otp"):
        resp = client.post(
            "/auth/signup",
            json={
                "email": "amara@example.com",
                "phone": "0244000111",
                "full_name": "Amara Owusu",
                "password": "supersecret1",
            },
        )
    assert resp.status_code == 201
    assert "user_id" in resp.json
    _extract_code(caplog)  # asserts a code was logged


def test_signup_duplicate_email_rejected(client):
    client.post(
        "/auth/signup",
        json={"email": "dup@example.com", "phone": "0244000222", "full_name": "A", "password": "supersecret1"},
    )
    resp = client.post(
        "/auth/signup",
        json={"email": "dup@example.com", "phone": "0244000333", "full_name": "B", "password": "supersecret1"},
    )
    assert resp.status_code == 409


def test_signup_rejects_invalid_ghana_phone(client):
    resp = client.post(
        "/auth/signup",
        json={"email": "badphone@example.com", "phone": "12345", "full_name": "A", "password": "supersecret1"},
    )
    assert resp.status_code == 422


def test_verify_otp_activates_account_and_allows_login(client, caplog):
    with caplog.at_level("INFO", logger="launchgh.otp"):
        client.post(
            "/auth/signup",
            json={
                "email": "kojo@example.com",
                "phone": "0244000444",
                "full_name": "Kojo Mensah",
                "password": "supersecret1",
            },
        )
    code = _extract_code(caplog)

    verify_resp = client.post("/auth/verify-otp", json={"identifier": "0244000444", "code": code})
    assert verify_resp.status_code == 200

    login_resp = client.post("/auth/login", json={"email": "kojo@example.com", "password": "supersecret1"})
    assert login_resp.status_code == 200
    assert "access_token" in login_resp.json
    assert "refresh_token" in login_resp.json


def test_login_before_verification_is_rejected(client, caplog):
    with caplog.at_level("INFO", logger="launchgh.otp"):
        client.post(
            "/auth/signup",
            json={
                "email": "unverified@example.com",
                "phone": "0244000555",
                "full_name": "Nana",
                "password": "supersecret1",
            },
        )
    resp = client.post("/auth/login", json={"email": "unverified@example.com", "password": "supersecret1"})
    assert resp.status_code == 401


def test_verify_otp_wrong_code_rejected(client, caplog):
    with caplog.at_level("INFO", logger="launchgh.otp"):
        client.post(
            "/auth/signup",
            json={
                "email": "wrongcode@example.com",
                "phone": "0244000666",
                "full_name": "Yaw",
                "password": "supersecret1",
            },
        )
    resp = client.post("/auth/verify-otp", json={"identifier": "0244000666", "code": "000000"})
    assert resp.status_code == 422


def test_verify_otp_expired_code_rejected(client, caplog, monkeypatch):
    import app.auth.service as service_mod

    monkeypatch.setattr(service_mod, "OTP_TTL_MINUTES", -1)
    with caplog.at_level("INFO", logger="launchgh.otp"):
        client.post(
            "/auth/signup",
            json={
                "email": "expired@example.com",
                "phone": "0244000777",
                "full_name": "Efua",
                "password": "supersecret1",
            },
        )
    code = _extract_code(caplog)
    resp = client.post("/auth/verify-otp", json={"identifier": "0244000777", "code": code})
    assert resp.status_code == 422
