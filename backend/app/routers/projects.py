from fastapi import APIRouter, HTTPException, Depends, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.db import get_db
from app.config import settings
from app.auth.service import get_current_user
from app.auth.rbac import require_project_role, require_min_role
from app.models.user import User
from app.models.project import Project
from app.models.project_member import ProjectMember
from app.services.audit import log_audit

router = APIRouter(prefix="/projects", tags=["Projects"])


# ── Schemas ──────────────────────────────────────────────

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class MemberAdd(BaseModel):
    user_id: int
    role: str = "VIEWER"


class MemberUpdate(BaseModel):
    role: str


# ── Project CRUD ─────────────────────────────────────────

@router.post("", status_code=201)
def create_project(
    data: ProjectCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = Project(
        name=data.name,
        description=data.description,
        created_by=current_user.id,
    )
    db.add(project)
    db.flush()

    # creator is OWNER
    member = ProjectMember(
        project_id=project.id,
        user_id=current_user.id,
        role="OWNER",
    )
    db.add(member)

    log_audit(db, "CREATE_PROJECT", current_user.id,
              project_id=project.id, ip_address=request.client.host,
              project_name=data.name)
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
    member: ProjectMember = Depends(require_min_role("AUDITOR")),
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


@router.patch("/{project_id}")
def update_project(
    project_id: int,
    data: ProjectUpdate,
    request: Request,
    member: ProjectMember = Depends(require_min_role("ADMIN")),
    db: Session = Depends(get_db),
):
    """Update project name/description. Admin+ only."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")

    if data.name is not None:
        project.name = data.name
    if data.description is not None:
        project.description = data.description

    log_audit(db, "UPDATE_PROJECT", member.user_id,
              project_id=project_id, ip_address=request.client.host,
              name=data.name, description=data.description)
    db.commit()
    return {"msg": "Project updated"}


# ── Members ──────────────────────────────────────────────

@router.post("/{project_id}/members", status_code=201)
def add_member(
    project_id: int,
    data: MemberAdd,
    request: Request,
    member: ProjectMember = Depends(require_min_role("ADMIN")),
    db: Session = Depends(get_db),
):
    """Add a member. Admin+ only."""
    user = db.query(User).filter(User.id == data.user_id).first()
    if not user:
        raise HTTPException(404, "User not found")

    existing = (
        db.query(ProjectMember)
        .filter(ProjectMember.project_id == project_id, ProjectMember.user_id == data.user_id)
        .first()
    )
    if existing:
        raise HTTPException(409, "User is already a member")

    if data.role not in settings.ALL_ROLES:
        raise HTTPException(400, f"Invalid role. Must be one of {settings.ALL_ROLES}")

    # cannot assign OWNER role
    if data.role == "OWNER":
        raise HTTPException(400, "Cannot assign OWNER role. There can only be one owner.")

    new_member = ProjectMember(project_id=project_id, user_id=data.user_id, role=data.role)
    db.add(new_member)

    log_audit(db, "ADD_MEMBER", member.user_id,
              project_id=project_id, ip_address=request.client.host,
              added_user_id=data.user_id, role=data.role)
    db.commit()
    return {"msg": "Member added", "user_id": data.user_id, "role": data.role}


@router.get("/{project_id}/members")
def list_members(
    project_id: int,
    member: ProjectMember = Depends(require_min_role("AUDITOR")),
    db: Session = Depends(get_db),
):
    members = db.query(ProjectMember).filter(ProjectMember.project_id == project_id).all()
    results = []
    for m in members:
        user = db.query(User).filter(User.id == m.user_id).first()
        results.append({
            "id": m.id,
            "user_id": m.user_id,
            "name": user.name if user else None,
            "email": user.email if user else None,
            "role": m.role,
        })
    return results


@router.patch("/{project_id}/members/{user_id}")
def update_member_role(
    project_id: int,
    user_id: int,
    data: MemberUpdate,
    request: Request,
    member: ProjectMember = Depends(require_min_role("ADMIN")),
    db: Session = Depends(get_db),
):
    """Update a member's role. Admin+ only."""
    if data.role not in settings.ALL_ROLES:
        raise HTTPException(400, f"Invalid role. Must be one of {settings.ALL_ROLES}")
    if data.role == "OWNER":
        raise HTTPException(400, "Cannot assign OWNER role via this endpoint.")

    target = (
        db.query(ProjectMember)
        .filter(ProjectMember.project_id == project_id, ProjectMember.user_id == user_id)
        .first()
    )
    if not target:
        raise HTTPException(404, "Member not found")
    if target.role == "OWNER":
        raise HTTPException(400, "Cannot change the OWNER's role")

    old_role = target.role
    target.role = data.role

    log_audit(db, "UPDATE_MEMBER_ROLE", member.user_id,
              project_id=project_id, ip_address=request.client.host,
              target_user_id=user_id, old_role=old_role, new_role=data.role)
    db.commit()
    return {"msg": "Role updated", "user_id": user_id, "new_role": data.role}


@router.delete("/{project_id}/members/{user_id}")
def remove_member(
    project_id: int,
    user_id: int,
    request: Request,
    member: ProjectMember = Depends(require_min_role("ADMIN")),
    db: Session = Depends(get_db),
):
    """Remove a member. Admin+ only. Cannot remove OWNER or self."""
    if user_id == member.user_id:
        raise HTTPException(400, "Cannot remove yourself")

    target = (
        db.query(ProjectMember)
        .filter(ProjectMember.project_id == project_id, ProjectMember.user_id == user_id)
        .first()
    )
    if not target:
        raise HTTPException(404, "Member not found")
    if target.role == "OWNER":
        raise HTTPException(400, "Cannot remove the project OWNER")

    db.delete(target)
    log_audit(db, "REMOVE_MEMBER", member.user_id,
              project_id=project_id, ip_address=request.client.host,
              removed_user_id=user_id)
    db.commit()
    return {"msg": "Member removed", "user_id": user_id}

# ── Dashboard & Metrics ──────────────────────────────────

@router.get("/{project_id}/analysis/summary")
def get_project_analysis_summary(
    project_id: int,
    member: ProjectMember = Depends(require_min_role("VIEWER")),
    db: Session = Depends(get_db),
):
    """Return a mock AI Verdict for the dashboard."""
    return {
        "risk_score": 67,
        "verdict": "PROCEED_WITH_CAUTION",
        "confidence": 0.82,
        "highlights": [
            {"label": "Inconsistent IP Clauses", "type": "LEGAL"},
            {"label": "Pending Litigation", "type": "LEGAL"},
            {"label": "Unusual Burn Rate", "type": "FINANCIAL"}
        ],
        "explanation": "Our AI engine has flagged several medium-to-high risk anomalies that require legal oversight before finalization."
    }

@router.get("/{project_id}/metrics")
def get_project_metrics(
    project_id: int,
    member: ProjectMember = Depends(require_min_role("VIEWER")),
    db: Session = Depends(get_db),
):
    """Return mock metrics for the 4 KPI tiles."""
    return {
        "total_docs": 142,
        "docs_uploaded_today": 12,
        "processed_docs": 128,
        "flagged_risks": 23,
        "risk_level": "HIGH",
        "reports_generated": 3,
        "latest_report_status": "FINAL_DRAFT"
    }

@router.get("/{project_id}/processing/status")
def get_project_processing_status(
    project_id: int,
    member: ProjectMember = Depends(require_min_role("VIEWER")),
    db: Session = Depends(get_db),
):
    """Return mock processing pipeline status."""
    return {
        "stages": {
            "TEXT_EXTRACTION": 1.0,
            "PII_SCANNING": 0.85,
            "STRUCTURING": 0.60,
            "AI_ANALYSIS": 0.30
        },
        "current": {
            "stage": "AI_ANALYSIS",
            "doc_id": "doc-xyz",
            "filename": "14.pdf",
            "message": "Extracting risk factors from 14.pdf"
        }
    }
