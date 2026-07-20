from app.core.enums import RoleName
from tests.helpers import make_user


def test_login_success_returns_tokens(client):
    make_user(email="loginok@example.com", password="supersecret1")
    resp = client.post("/auth/login", json={"email": "loginok@example.com", "password": "supersecret1"})
    assert resp.status_code == 200
    assert resp.json["access_token"]
    assert resp.json["refresh_token"]


def test_login_wrong_password_rejected(client):
    make_user(email="wrongpass@example.com", password="supersecret1")
    resp = client.post("/auth/login", json={"email": "wrongpass@example.com", "password": "nope"})
    assert resp.status_code == 401


def test_login_unknown_email_rejected(client):
    resp = client.post("/auth/login", json={"email": "ghost@example.com", "password": "whatever1"})
    assert resp.status_code == 401


def test_me_endpoint_returns_roles(client):
    make_user(email="meroles@example.com", roles=[RoleName.CASE_OFFICER])
    login = client.post("/auth/login", json={"email": "meroles@example.com", "password": "correcthorsebattery"})
    headers = {"Authorization": f"Bearer {login.json['access_token']}"}
    resp = client.get("/auth/me", headers=headers)
    assert resp.status_code == 200
    assert resp.json["roles"] == ["case_officer"]


def test_me_requires_auth(client):
    resp = client.get("/auth/me")
    assert resp.status_code == 401
