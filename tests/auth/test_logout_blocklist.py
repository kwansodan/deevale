from tests.helpers import make_user


def test_logout_blocklists_access_token(client):
    make_user(email="logout@example.com", password="supersecret1")
    login = client.post("/auth/login", json={"email": "logout@example.com", "password": "supersecret1"})
    headers = {"Authorization": f"Bearer {login.json['access_token']}"}

    assert client.get("/auth/me", headers=headers).status_code == 200

    logout_resp = client.post("/auth/logout", headers=headers)
    assert logout_resp.status_code == 200

    assert client.get("/auth/me", headers=headers).status_code == 401


def test_logout_also_blocklists_supplied_refresh_token(client):
    make_user(email="logoutrefresh@example.com", password="supersecret1")
    login = client.post("/auth/login", json={"email": "logoutrefresh@example.com", "password": "supersecret1"})
    access = login.json["access_token"]
    refresh = login.json["refresh_token"]

    client.post(
        "/auth/logout",
        headers={"Authorization": f"Bearer {access}"},
        json={"refresh_token": refresh},
    )

    resp = client.post("/auth/refresh", headers={"Authorization": f"Bearer {refresh}"})
    assert resp.status_code == 401


def test_logout_requires_auth(client):
    resp = client.post("/auth/logout")
    assert resp.status_code == 401
