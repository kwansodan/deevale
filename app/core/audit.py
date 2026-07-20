import uuid

from flask import request

from app.core.models import AuditLog
from app.extensions import db


def write_audit_log(
    action: str,
    actor_user_id: uuid.UUID | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    context: dict | None = None,
) -> AuditLog:
    try:
        ip_address = request.remote_addr
        user_agent = request.headers.get("User-Agent")
    except RuntimeError:
        ip_address = None
        user_agent = None

    log = AuditLog(
        actor_user_id=actor_user_id,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id is not None else None,
        context=context or {},
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.session.add(log)
    return log
