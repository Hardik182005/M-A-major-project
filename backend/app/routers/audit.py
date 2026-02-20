from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.auth.service import get_current_user
from app.auth.rbac import require_project_role
from app.models.user import User
from app.models.project_member import ProjectMember
from app.models.audit import AuditEvent

router = APIRouter(tags=["Audit"])


@router.get("/projects/{project_id}/audit")
def list_audit_events(
    project_id: int,
    action: Optional[str] = Query(None, description="Filter by action type, e.g. UPLOAD_DOCUMENT"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    member: ProjectMember = Depends(require_project_role(["ADMIN"])),
    db: Session = Depends(get_db),
):
    """
    List audit events for a project. Admin only.

    Supports filtering by action and pagination.
    """
    query = (
        db.query(AuditEvent)
        .filter(AuditEvent.project_id == project_id)
    )

    if action:
        query = query.filter(AuditEvent.action == action)

    total = query.count()

    events = (
        query
        .order_by(AuditEvent.timestamp.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "events": [
            {
                "id": e.id,
                "project_id": e.project_id,
                "document_id": e.document_id,
                "action": e.action,
                "actor_id": e.actor_id,
                "ip_address": e.ip_address,
                "timestamp": e.timestamp.isoformat() if e.timestamp else None,
                "meta_json": e.meta_json,
            }
            for e in events
        ],
    }


@router.get("/audit/global")
def list_global_audit(
    action: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List all audit events (global, not project-specific).
    Shows events where project_id is null (REGISTER, LOGIN).
    Only shows the current user's own global events.
    """
    query = (
        db.query(AuditEvent)
        .filter(
            AuditEvent.project_id == None,  # noqa: E711
            AuditEvent.actor_id == current_user.id,
        )
    )

    if action:
        query = query.filter(AuditEvent.action == action)

    total = query.count()

    events = (
        query
        .order_by(AuditEvent.timestamp.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return {
        "total": total,
        "events": [
            {
                "id": e.id,
                "action": e.action,
                "actor_id": e.actor_id,
                "ip_address": e.ip_address,
                "timestamp": e.timestamp.isoformat() if e.timestamp else None,
                "meta_json": e.meta_json,
            }
            for e in events
        ],
    }
