from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.auth.rbac import require_project_role
from app.models.project_member import ProjectMember
from app.models.audit import AuditEvent

router = APIRouter(tags=["Audit"])


@router.get("/projects/{project_id}/audit")
def list_audit_events(
    project_id: int,
    member: ProjectMember = Depends(require_project_role(["ADMIN"])),
    db: Session = Depends(get_db),
):
    """List audit events for a project. Only ADMINs can view audit logs."""
    events = (
        db.query(AuditEvent)
        .filter(AuditEvent.project_id == project_id)
        .order_by(AuditEvent.timestamp.desc())
        .all()
    )
    return [
        {
            "id": e.id,
            "project_id": e.project_id,
            "document_id": e.document_id,
            "action": e.action,
            "actor_id": e.actor_id,
            "timestamp": e.timestamp.isoformat() if e.timestamp else None,
            "meta_json": e.meta_json,
        }
        for e in events
    ]
