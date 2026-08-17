import uuid

from app.core.enums import RoleName
from tests.helpers import auth_headers, make_user


def test_public_init_session_and_page_tracking(client):
    visitor_id = "vis_test_" + uuid.uuid4().hex[:8]
    resp = client.post(
        "/public/live-chat/session",
        json={
            "visitor_id": visitor_id,
            "page": "/pricing",
            "referrer": "https://google.com",
        },
    )
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["visitor_id"] == visitor_id
    assert data["current_page"] == "/pricing"
    assert data["is_online"] is True
    assert data["status"] == "active"


def test_public_visitor_contact_update(client):
    visitor_id = "vis_test_" + uuid.uuid4().hex[:8]
    init_resp = client.post("/public/live-chat/session", json={"visitor_id": visitor_id, "page": "/"})
    session_id = init_resp.get_json()["id"]

    resp = client.patch(
        f"/public/live-chat/sessions/{session_id}/contact",
        json={
            "visitor_name": "Kofi Mensah",
            "visitor_email": "kofi@example.com",
            "visitor_phone": "+233244123456",
        },
    )
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["visitor_name"] == "Kofi Mensah"
    assert data["visitor_email"] == "kofi@example.com"
    assert data["visitor_phone"] == "+233244123456"


def test_visitor_and_staff_message_exchange(client):
    visitor_id = "vis_test_" + uuid.uuid4().hex[:8]
    init_resp = client.post("/public/live-chat/session", json={"visitor_id": visitor_id, "page": "/"})
    session_id = init_resp.get_json()["id"]

    # 1. Visitor posts a message
    msg_resp = client.post(
        f"/public/live-chat/sessions/{session_id}/messages",
        json={"body": "Hello, how much is company registration?"},
    )
    assert msg_resp.status_code == 201
    msg_data = msg_resp.get_json()
    assert msg_data["body"] == "Hello, how much is company registration?"
    assert msg_data["sender_type"] == "visitor"

    # 2. Staff user responds
    officer = make_user(roles=[RoleName.CASE_OFFICER], full_name="Officer Kwame")
    staff_resp = client.post(
        f"/ops/live-chat/sessions/{session_id}/messages",
        headers=auth_headers(officer),
        json={"body": "Hello! LLC incorporation starts from GHS 950."},
    )
    assert staff_resp.status_code == 201
    staff_data = staff_resp.get_json()
    assert staff_data["sender_type"] == "staff"
    assert staff_data["sender_name"] == "Officer Kwame"

    # 3. Visitor fetches message transcript
    get_resp = client.get(f"/public/live-chat/sessions/{session_id}/messages")
    assert get_resp.status_code == 200
    messages = get_resp.get_json()
    assert len(messages) == 2
    assert messages[0]["body"] == "Hello, how much is company registration?"
    assert messages[1]["body"] == "Hello! LLC incorporation starts from GHS 950."


def test_ops_rbac_protection(client):
    regular_client = make_user(roles=[RoleName.CLIENT])
    officer = make_user(roles=[RoleName.CASE_OFFICER])

    # Client role cannot access ops visitors
    denied = client.get("/ops/live-chat/visitors", headers=auth_headers(regular_client))
    assert denied.status_code == 403

    # Officer can access
    allowed = client.get("/ops/live-chat/visitors", headers=auth_headers(officer))
    assert allowed.status_code == 200


def test_ops_close_session(client):
    visitor_id = "vis_test_" + uuid.uuid4().hex[:8]
    init_resp = client.post("/public/live-chat/session", json={"visitor_id": visitor_id, "page": "/"})
    session_id = init_resp.get_json()["id"]

    officer = make_user(roles=[RoleName.ADMIN])
    close_resp = client.patch(
        f"/ops/live-chat/sessions/{session_id}/close",
        headers=auth_headers(officer),
    )
    assert close_resp.status_code == 200
    assert close_resp.get_json()["status"] == "closed"
