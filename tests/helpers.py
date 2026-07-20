import uuid

from app.auth.models import Role, User
from app.auth.service import build_tokens, hash_password
from app.core.enums import RoleName
from app.extensions import db


def make_user(
    email: str | None = None,
    phone: str | None = None,
    full_name: str = "Test User",
    password: str = "correcthorsebattery",
    roles: list[RoleName] | None = None,
    verified: bool = True,
) -> User:
    unique = uuid.uuid4().hex[:8]
    email = email or f"user-{unique}@example.com"
    phone = phone or f"+2332{unique[:8]}"

    user = User(
        id=uuid.uuid4(),
        email=email,
        phone=phone,
        full_name=full_name,
        password_hash=hash_password(password),
        is_active=True,
        is_email_verified=verified,
        is_phone_verified=verified,
    )
    for role_name in roles or [RoleName.CLIENT]:
        role = Role.query.filter_by(name=role_name.value).first()
        if role is None:
            role = Role(name=role_name.value)
            db.session.add(role)
            db.session.flush()
        user.roles.append(role)

    db.session.add(user)
    db.session.commit()
    return user


def auth_headers(user: User) -> dict:
    tokens = build_tokens(user)
    return {"Authorization": f"Bearer {tokens['access_token']}"}


def make_approved_document(case, task, uploaded_by: User):
    """Creates a Document + approved DocumentVersion and links it to the given
    CaseTask, simulating the outcome of the upload+review flow built in
    prompt 1.5 (which doesn't exist yet when prompt 1.4's workflow tests run).
    """
    from app.documents.models import Document, DocumentVersion

    document = Document(
        id=uuid.uuid4(),
        business_case_id=case.id,
        case_task_id=task.id,
        document_type_code=task.required_document_type or "other",
        uploaded_by_user_id=uploaded_by.id,
        current_version_number=1,
    )
    db.session.add(document)
    db.session.flush()

    version = DocumentVersion(
        id=uuid.uuid4(),
        document_id=document.id,
        version_number=1,
        s3_key=f"test/{document.id}/v1",
        original_filename="evidence.pdf",
        content_type="application/pdf",
        size_bytes=1024,
        upload_status="uploaded",
        review_status="approved",
    )
    db.session.add(version)

    task.linked_document_id = document.id
    db.session.commit()
    return document


def make_bare_case(client_user: User):
    """Creates a minimal BusinessCase row directly (bypassing CaseFactory,
    which is built in prompt 1.4) -- enough to exercise ownership checks in
    prompt 1.3's auth/RBAC tests.
    """
    from app.workflow.models import BusinessCase

    unique = uuid.uuid4().hex[:8]
    case = BusinessCase(
        id=uuid.uuid4(),
        case_number=f"LGH-TEST-{unique}",
        client_id=client_user.id,
        entity_type="company_limited_by_shares",
        status="draft",
        onboarding_payload={},
    )
    db.session.add(case)
    db.session.commit()
    return case
