from app.core.enums import RoleName
from app.core.events.bus import bus
from app.core.events.events import CaseBlocked
from app.extensions import db
from app.notifications.copy import render_notification
from app.notifications.models import Notification
from app.workflow.case_factory import CaseFactory
from app.workflow.seed_workflow_company_ltd import seed_company_ltd_workflow
from tests.helpers import make_user


def test_render_notification_falls_back_to_english_for_missing_locale():
    title_en, _ = render_notification("action_required", {"task_name": "Upload ID", "business_name": "X"})
    title_missing, _ = render_notification(
        "action_required", {"task_name": "Upload ID", "business_name": "X"}, locale="zz"
    )
    assert title_en == title_missing == "Action needed: Upload ID"


def test_render_notification_uses_twi_when_available():
    title_tw, body_tw = render_notification(
        "action_required", {"task_name": "Upload ID", "business_name": "X"}, locale="tw"
    )
    assert title_tw == "Deɛ ɛsɛ sɛ woyɛ: Upload ID"
    assert "X" in body_tw


def test_dispatch_uses_recipient_locale(app):
    with app.app_context():
        seed_company_ltd_workflow()
        client_user = make_user(email="locale-user@example.com", roles=[RoleName.CLIENT])
        client_user.locale = "tw"
        db.session.commit()
        case = CaseFactory.create_from_onboarding(
            client_user, {"entity_type": "company_limited_by_shares", "business_name": "Loco"}
        )

        bus.dispatch(CaseBlocked(case_id=case.id, reason="Missing docs"))

        note = Notification.query.filter_by(user_id=client_user.id, category="case_blocked").one()
        assert note.title.startswith("Hwɛ:")  # Twi title


def test_set_locale_endpoint(app, client):
    with app.app_context():
        from tests.helpers import auth_headers

        user = make_user(email="locale-set@example.com", roles=[RoleName.CLIENT])
        resp = client.put("/auth/me/locale", headers=auth_headers(user), json={"locale": "tw"})
        assert resp.status_code == 200
        db.session.refresh(user)
        assert user.locale == "tw"

        bad = client.put("/auth/me/locale", headers=auth_headers(user), json={"locale": "xx"})
        assert bad.status_code == 422
