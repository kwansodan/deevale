from app.core.models import AuditLog
from tests.helpers import make_user


def test_login_success_writes_audit_log(client):
    make_user(email="auditok@example.com", password="supersecret1")
    client.post("/auth/login", json={"email": "auditok@example.com", "password": "supersecret1"})

    logs = AuditLog.query.filter_by(action="login_success").all()
    assert len(logs) == 1
    assert logs[0].entity_type == "user"


def test_login_failure_writes_audit_log(client):
    make_user(email="auditfail@example.com", password="supersecret1")
    client.post("/auth/login", json={"email": "auditfail@example.com", "password": "wrongpassword"})

    logs = AuditLog.query.filter_by(action="login_failed").all()
    assert len(logs) == 1
    assert logs[0].context["email"] == "auditfail@example.com"


def test_password_reset_requested_and_completed_write_audit_logs(client, caplog):
    import re

    make_user(email="auditreset@example.com", password="oldpassword1")

    with caplog.at_level("INFO", logger="launchgh.otp"):
        client.post("/auth/password-reset/request", json={"email": "auditreset@example.com"})
    assert AuditLog.query.filter_by(action="password_reset_requested").count() == 1

    code = None
    for record in caplog.records:
        m = re.search(r"code is (\d{6})", record.getMessage())
        if m:
            code = m.group(1)
    assert code is not None

    client.post(
        "/auth/password-reset/confirm",
        json={"email": "auditreset@example.com", "code": code, "new_password": "newpassword123"},
    )
    assert AuditLog.query.filter_by(action="password_reset_completed").count() == 1
