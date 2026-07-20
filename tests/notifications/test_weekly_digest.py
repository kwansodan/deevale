from unittest.mock import MagicMock, patch

from app.core.enums import RoleName
from app.extensions import db
from app.notifications.models import NotificationPreference
from app.notifications.tasks import send_weekly_digests
from app.workflow.case_factory import CaseFactory
from app.workflow.seed_workflow_company_ltd import seed_company_ltd_workflow
from tests.helpers import make_user


def _opted_in_client(email):
    user = make_user(email=email, roles=[RoleName.CLIENT])
    db.session.add(
        NotificationPreference(
            user_id=user.id, category="weekly_digest", email_enabled=True, in_app_enabled=True
        )
    )
    db.session.commit()
    return user


def test_digest_sent_only_to_opted_in_users_with_cases(app):
    with app.app_context():
        seed_company_ltd_workflow()

        opted_with_case = _opted_in_client("digest1@example.com")
        CaseFactory.create_from_onboarding(
            opted_with_case, {"entity_type": "company_limited_by_shares", "business_name": "Digest Ltd"}
        )
        db.session.commit()

        not_opted = make_user(email="digest2@example.com", roles=[RoleName.CLIENT])
        CaseFactory.create_from_onboarding(not_opted, {"entity_type": "company_limited_by_shares"})
        db.session.commit()

        _opted_in_client("digest3@example.com")  # opted in, but no cases

        sender = MagicMock()
        with patch("app.notifications.channels.email.get_email_sender", return_value=sender):
            sent = send_weekly_digests.run()

        assert sent == 1
        assert sender.send.call_count == 1
        to_email, subject, _html, text = sender.send.call_args[0]
        assert to_email == "digest1@example.com"
        assert "weekly update" in subject.lower()
        assert "Digest Ltd" in text
