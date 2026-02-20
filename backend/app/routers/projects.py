import json
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.db import get_db
from app.auth.service import get_current_user
from app.auth.rbac import require_project_role
from app.models.user import User
from app.models.project import Project
from app.models.project_member import ProjectMember
from app.models.audit import AuditEvent

router = APIRouter(prefix="/projects", tags=["Projects"])


# ── Schemas ──────────────────────────────────────────────
class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None


class ProjectOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    created_by: int
    created_at: str  # ISO string
    role: Optional[str] = None  # user's role in the project

    class Config:
        from_attributes = True


class MemberAdd(BaseModel):
    user_id: int
    role: str = "VIEWER"  # ADMIN | ANALYST | VIEWER


class MemberOut(BaseModel):
    id: int
    user_id: int
    role: str

    class Config:
        from_attributes = True


# ── Endpoints ────────────────────────────────────────────

@router.post("", status_code=201)
def create_project(
    data: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = Project(
        name=data.name,
        description=data.description,
        created_by=current_user.id,
    )
    db.add(project)
    db.flush()  # get project.id

    # creator is automatically ADMIN
    member = ProjectMember(
        project_id=project.id,
        user_id=current_user.id,
        role="ADMIN",
    )
    db.add(member)

    # audit
    audit = AuditEvent(
        project_id=project.id,
        action="CREATE_PROJECT",
        actor_id=current_user.id,
        meta_json=json.dumps({"project_name": data.name}),
    )
    db.add(audit)
    db.commit()
    db.refresh(project)
    return {
        "msg": "Project created",
        "project_id": project.id,
        "name": project.name,
    }


@router.get("")
def list_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all projects where the current user is a member."""
    memberships = (
        db.query(ProjectMember)
        .filter(ProjectMember.user_id == current_user.id)
        .all()
    )
    results = []
    for m in memberships:
        project = db.query(Project).filter(Project.id == m.project_id).first()
        if project:
            results.append({
                "id": project.id,
                "name": project.name,
                "description": project.description,
                "created_by": project.created_by,
                "created_at": project.created_at.isoformat() if project.created_at else None,
                "role": m.role,
            })
    return results


@router.get("/{project_id}")
def get_project(
    project_id: int,
    member: ProjectMember = Depends(require_project_role(["ADMIN", "ANALYST", "VIEWER"])),
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "created_by": project.created_by,
        "created_at": project.created_at.isoformat() if project.created_at else None,
        "role": member.role,
    }


# ── Members management ──────────────────────────────────

@router.post("/{project_id}/members", status_code=201)
def add_member(
    project_id: int,
    data: MemberAdd,
    member: ProjectMember = Depends(require_project_role(["ADMIN"])),
    db: Session = Depends(get_db),
):
    """Only ADMINs can add members."""
    # check user exists
    user = db.query(User).filter(User.id == data.user_id).first()
    if not user:
        raise HTTPException(404, "User not found")

    # check not already a member
    existing = (
        db.query(ProjectMember)
        .filter(ProjectMember.project_id == project_id, ProjectMember.user_id == data.user_id)
        .first()
    )
    if existing:
        raise HTTPException(409, "User is already a member of this project")

    if data.role not in ("ADMIN", "ANALYST", "VIEWER"):
        raise HTTPException(400, "Invalid role. Must be ADMIN, ANALYST, or VIEWER")

    new_member = ProjectMember(
        project_id=project_id,
        user_id=data.user_id,
        role=data.role,
    )
    db.add(new_member)

    audit = AuditEvent(
        project_id=project_id,
        action="ADD_MEMBER",
        actor_id=member.user_id,
        meta_json=json.dumps({"added_user_id": data.user_id, "role": data.role}),
    )
    db.add(audit)
    db.commit()
    return {"msg": "Member added", "user_id": data.user_id, "role": data.role}


@router.get("/{project_id}/members")
def list_members(
    project_id: int,
    member: ProjectMember = Depends(require_project_role(["ADMIN", "ANALYST", "VIEWER"])),
    db: Session = Depends(get_db),
):
    members = db.query(ProjectMember).filter(ProjectMember.project_id == project_id).all()
    return [
        {"id": m.id, "user_id": m.user_id, "role": m.role}
        for m in members
    ]
