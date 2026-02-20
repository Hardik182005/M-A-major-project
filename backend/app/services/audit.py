"""Centralized audit logging utility."""
import json
from sqlalchemy.orm import Session
from app.models.audit import AuditEvent


def log_audit(
    db: Session,
    action: str,
    actor_id: int,
    project_id: int | None = None,
    document_id: int | None = None,
    ip_address: str | None = None,
    **meta,
):
    """
    Create an audit event in one call.

    Usage:
        log_audit(db, "UPLOAD_DOCUMENT", user.id, project_id=1, document_id=5,
                  filename="report.pdf", version=2)
    """
    event = AuditEvent(
        project_id=project_id,
        document_id=document_id,
        action=action,
        actor_id=actor_id,
        ip_address=ip_address,
        meta_json=json.dumps(meta) if meta else None,
    )
    db.add(event)
    return event
