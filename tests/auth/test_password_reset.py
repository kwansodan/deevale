import re

from tests.helpers import make_user

CODE_RE = re.compile(r"code is (\d{6})")


def _extract_code(caplog) -> str:
    for record in caplog.records:
        m = CODE_RE.search(record.getMessage())
        if m:
            return m.group(1)
    raise AssertionError("No OTP code found in logs")


def test_password_reset_full_flow(client, caplog):
    make_user(email="reset@example.com", password="oldpassword1")

    with caplog.at_level("INFO", logger="launchgh.otp"):
        req_resp = client.post("/auth/password-reset/request", json={"email": "reset@example.com"})
    assert req_resp.status_code == 200
    code = _extract_code(caplog)

    confirm_resp = client.post(
        "/auth/password-reset/confirm",
        json={"email": "reset@example.com", "code": code, "new_password": "brandnewpassword1"},
    )
    assert confirm_resp.status_code == 200

    old_login = client.post("/auth/login", json={"email": "reset@example.com", "password": "oldpassword1"})
    assert old_login.status_code == 401

    new_login = client.post("/auth/login", json={"email": "reset@example.com", "password": "brandnewpassword1"})
    assert new_login.status_code == 200


def test_password_reset_request_does_not_leak_account_existence(client):
    resp = client.post("/auth/password-reset/request", json={"email": "doesnotexist@example.com"})
    assert resp.status_code == 200


def test_password_reset_wrong_code_rejected(client, caplog):
    make_user(email="resetwrong@example.com", password="oldpassword1")
    with caplog.at_level("INFO", logger="launchgh.otp"):
        client.post("/auth/password-reset/request", json={"email": "resetwrong@example.com"})

    resp = client.post(
        "/auth/password-reset/confirm",
        json={"email": "resetwrong@example.com", "code": "000000", "new_password": "somethingnew1"},
    )
    assert resp.status_code == 422
