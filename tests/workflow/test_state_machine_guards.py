import pytest

from app.core.enums import RoleName
from app.core.errors import ForbiddenError, GuardViolationError
from app.workflow.case_factory import CaseFactory
from app.workflow.enums import StageStatus, TaskStatus
from app.workflow.seed_workflow_company_ltd import seed_company_ltd_workflow
from app.workflow.state_machine import StageStateMachine, TaskStateMachine
from tests.helpers import make_user


def _create_case(app, client_email="guardclient@example.com"):
    seed_company_ltd_workflow()
    client = make_user(email=client_email)
    case = CaseFactory.create_from_onboarding(client, {"entity_type": "company_limited_by_shares"})
    return client, case


def test_stage_cannot_complete_with_incomplete_required_tasks(app):
    with app.app_context():
        _, case = _create_case(app)
        staff = make_user(email="guardofficer1@example.com", roles=[RoleName.CASE_OFFICER])
        first_stage = min(case.stages, key=lambda s: s.sequence_order)

        with pytest.raises(GuardViolationError):
            StageStateMachine.transition(first_stage, StageStatus.COMPLETED, actor=staff)


def test_stage_completes_once_all_required_tasks_done_or_skipped(app):
    with app.app_context():
        _, case = _create_case(app, "guardclient2@example.com")
        staff = make_user(email="guardofficer2@example.com", roles=[RoleName.CASE_OFFICER])
        admin = make_user(email="guardadmin2@example.com", roles=[RoleName.ADMIN])
        first_stage = min(case.stages, key=lambda s: s.sequence_order)

        client_task = next(t for t in first_stage.tasks if t.assignee_type == "client")
        search_task = next(t for t in first_stage.tasks if t.code == "orc_name_search")
        filed_task = next(t for t in first_stage.tasks if t.code == "orc_name_reservation_filed")

        TaskStateMachine.transition(client_task, TaskStatus.DONE, actor=_owner(case))
        TaskStateMachine.transition(search_task, TaskStatus.DONE, actor=staff)
        # filed_task requires a document -- skip it via admin to unblock stage completion in this guard test.
        TaskStateMachine.transition(filed_task, TaskStatus.SKIPPED, actor=admin)

        StageStateMachine.transition(first_stage, StageStatus.COMPLETED, actor=staff)
        assert first_stage.status == "completed"


def test_task_requiring_document_cannot_be_done_without_approval(app):
    with app.app_context():
        _, case = _create_case(app, "guardclient3@example.com")
        staff = make_user(email="guardofficer3@example.com", roles=[RoleName.CASE_OFFICER])
        first_stage = min(case.stages, key=lambda s: s.sequence_order)
        filed_task = next(t for t in first_stage.tasks if t.code == "orc_name_reservation_filed")

        with pytest.raises(GuardViolationError):
            TaskStateMachine.transition(filed_task, TaskStatus.DONE, actor=staff)


def test_role_without_permission_cannot_transition_staff_task(app):
    with app.app_context():
        _, case = _create_case(app, "guardclient4@example.com")
        finance_user = make_user(email="guardfinance4@example.com", roles=[RoleName.FINANCE])
        first_stage = min(case.stages, key=lambda s: s.sequence_order)
        search_task = next(t for t in first_stage.tasks if t.code == "orc_name_search")

        with pytest.raises(ForbiddenError):
            TaskStateMachine.transition(search_task, TaskStatus.DONE, actor=finance_user)


def test_client_cannot_transition_staff_task(app):
    with app.app_context():
        client, case = _create_case(app, "guardclient5@example.com")
        first_stage = min(case.stages, key=lambda s: s.sequence_order)
        search_task = next(t for t in first_stage.tasks if t.code == "orc_name_search")

        with pytest.raises(ForbiddenError):
            TaskStateMachine.transition(search_task, TaskStatus.DONE, actor=client)


def test_staff_cannot_complete_client_task_via_client_only_semantics(app):
    with app.app_context():
        _, case = _create_case(app, "guardclient6@example.com")
        staff = make_user(email="guardofficer6@example.com", roles=[RoleName.CASE_OFFICER])
        first_stage = min(case.stages, key=lambda s: s.sequence_order)
        client_task = next(t for t in first_stage.tasks if t.assignee_type == "client")

        with pytest.raises(ForbiddenError):
            TaskStateMachine.transition(client_task, TaskStatus.DONE, actor=staff)


def test_only_admin_can_skip_a_task(app):
    with app.app_context():
        _, case = _create_case(app, "guardclient7@example.com")
        staff = make_user(email="guardofficer7@example.com", roles=[RoleName.CASE_OFFICER])
        first_stage = min(case.stages, key=lambda s: s.sequence_order)
        search_task = next(t for t in first_stage.tasks if t.code == "orc_name_search")

        with pytest.raises(ForbiddenError):
            TaskStateMachine.transition(search_task, TaskStatus.SKIPPED, actor=staff)


def test_invalid_transition_raises_guard_violation(app):
    with app.app_context():
        _, case = _create_case(app, "guardclient8@example.com")
        staff = make_user(email="guardofficer8@example.com", roles=[RoleName.CASE_OFFICER])
        first_stage = min(case.stages, key=lambda s: s.sequence_order)
        search_task = next(t for t in first_stage.tasks if t.code == "orc_name_search")
        search_task.status = TaskStatus.DONE.value

        with pytest.raises(GuardViolationError):
            TaskStateMachine.transition(search_task, TaskStatus.IN_PROGRESS, actor=staff)


def _owner(case):
    from app.auth.models import User

    return User.query.get(case.client_id)
