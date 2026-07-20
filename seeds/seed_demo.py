"""Rich demo seed: staff accounts, 3 clients, 6 cases spread across different
stages, unread notifications. Idempotent-ish: skips users that already exist.

Run with: make demo  (or python -m seeds.seed_demo)
Demo password for every account: Demo1234!
"""

import uuid

from app import create_app
from app.auth.models import User
from app.auth.service import get_or_create_role, hash_password
from app.core.enums import RoleName
from app.core.events.bus import bus
from app.core.events.events import PaymentReceived, TaskAwaitingClient
from app.extensions import db
from app.workflow.case_factory import CaseFactory
from app.workflow.enums import StageStatus, TaskStatus
from app.workflow.models import CaseStage, CaseTask
from app.workflow.state_machine import StageStateMachine, TaskStateMachine
from seeds import seed_fee_schedule, seed_roles, seed_workflow_definitions

DEMO_PASSWORD = "Demo1234!"


def _user(email: str, phone: str, name: str, roles: list[RoleName]) -> User:
    existing = User.query.filter_by(email=email).first()
    if existing:
        return existing
    user = User(
        id=uuid.uuid4(),
        email=email,
        phone=phone,
        full_name=name,
        password_hash=hash_password(DEMO_PASSWORD),
        is_active=True,
        is_email_verified=True,
        is_phone_verified=True,
    )
    for role in roles:
        user.roles.append(get_or_create_role(role))
    db.session.add(user)
    db.session.flush()
    return user


def _case(client: User, business_name: str, employees: int = 0):
    return CaseFactory.create_from_onboarding(
        client,
        {
            "entity_type": "company_limited_by_shares",
            "business_name": business_name,
            "sector": "it_services",
            "region": "Greater Accra",
            "planned_employees": employees,
            "nationality": "ghanaian",
            "owners": [{"full_name": client.full_name, "role": "director_shareholder", "nationality": "ghanaian"}],
        },
    )


def _stage(case, code) -> CaseStage:
    return next(s for s in case.stages if s.code == code)


def _finish_stage_one(case, officer, admin):
    """Drives Name Reservation to completion (skipping the document-gated
    task via admin, to keep the seed self-contained without S3)."""
    stage1 = _stage(case, "name_reservation")
    client_user = User.query.get(case.client_id)
    for task in stage1.tasks:
        task_obj = CaseTask.query.get(task.id)
        if task_obj.status in (TaskStatus.DONE.value, TaskStatus.SKIPPED.value):
            continue
        if task_obj.requires_document:
            TaskStateMachine.transition(task_obj, TaskStatus.SKIPPED, actor=admin)
        elif task_obj.assignee_type == "client":
            TaskStateMachine.transition(task_obj, TaskStatus.DONE, actor=client_user)
        else:
            TaskStateMachine.transition(task_obj, TaskStatus.DONE, actor=officer)
    StageStateMachine.transition(stage1, StageStatus.COMPLETED, actor=officer)


def run() -> None:
    seed_roles.run()
    seed_fee_schedule.run()
    seed_workflow_definitions.run()

    officer = _user("officer@launchgh.demo", "+233240000001", "Kwame Boateng", [RoleName.CASE_OFFICER])
    _user("reviewer@launchgh.demo", "+233240000002", "Abena Sarpong", [RoleName.REVIEWER])
    _user("finance@launchgh.demo", "+233240000003", "Yaw Darko", [RoleName.FINANCE])
    admin = _user("admin@launchgh.demo", "+233240000004", "Esi Amankwah", [RoleName.ADMIN])

    ama = _user("ama@client.demo", "+233240000010", "Ama Owusu", [RoleName.CLIENT])
    kofi = _user("kofi@client.demo", "+233240000011", "Kofi Mensah", [RoleName.CLIENT])
    efua = _user("efua@client.demo", "+233240000012", "Efua Asante", [RoleName.CLIENT])
    db.session.commit()

    from app.workflow.models import BusinessCase

    if BusinessCase.query.count() > 0:
        print("Cases already exist -- skipping demo case creation.")
        return

    # 1. Fresh case, just created (name reservation in progress).
    c1 = _case(ama, "Accra Tech Solutions", employees=2)
    c1.assigned_officer_id = officer.id

    # 2. Case awaiting client input (action-needed notification).
    c2 = _case(kofi, "Mensah Logistics")
    c2.assigned_officer_id = officer.id
    stage1 = _stage(c2, "name_reservation")
    names_task = next(t for t in stage1.tasks if t.code == "submit_proposed_names")
    bus.dispatch(TaskAwaitingClient(case_id=c2.id, task_id=names_task.id))

    # 3. Case paid + name reservation done -> incorporation in progress.
    c3 = _case(efua, "Asante Farms Ltd", employees=5)
    c3.assigned_officer_id = officer.id
    from app.payments.invoice_service import create_invoice_from_case, mark_invoice_paid
    from app.payments.models import Payment

    invoice = create_invoice_from_case(c3)
    payment = Payment(
        id=uuid.uuid4(),
        invoice_id=invoice.id,
        provider="paystack",
        provider_reference=f"demo-{invoice.invoice_number}",
        channel="mobile_money",
        amount_minor=invoice.total_minor,
        currency="GHS",
        status="success",
    )
    db.session.add(payment)
    mark_invoice_paid(invoice)
    db.session.commit()
    bus.dispatch(PaymentReceived(case_id=c3.id, invoice_id=invoice.id, payment_id=payment.id))
    db.session.commit()
    _finish_stage_one(c3, officer, admin)
    db.session.commit()

    # 4-6. More cases at various early stages for queue volume (one left
    # unassigned so the "Unassigned" queue filter has something to show).
    _case(ama, "Owusu Consult")
    c5 = _case(kofi, "GoldCoast Imports")
    c5.assigned_officer_id = officer.id
    _case(efua, "Efua's Kitchen Ltd", employees=8)

    db.session.commit()

    print("Demo seeded:")
    print(f"  staff:   officer@launchgh.demo / reviewer@ / finance@ / admin@  (password: {DEMO_PASSWORD})")
    print(f"  clients: ama@client.demo, kofi@client.demo, efua@client.demo   (password: {DEMO_PASSWORD})")
    print(f"  cases:   {BusinessCase.query.count()} across different stages")


if __name__ == "__main__":
    app = create_app()
    with app.app_context():
        run()
