import os
import json
import uuid
import shutil
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.db import get_db
from app.auth.service import get_current_user
from app.auth.rbac import require_project_role
from app.models.user import User
from app.models.project import Project
from app.models.project_member import ProjectMember
from app.models.document import Document
from app.models.audit import AuditEvent

router = APIRouter(tags=["Documents"])

# Storage directory (relative to backend/)
STORAGE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "storage")
os.makedirs(STORAGE_DIR, exist_ok=True)


# ── Upload ───────────────────────────────────────────────

@router.post("/projects/{project_id}/documents/upload", status_code=201)
def upload_document(
    project_id: int,
    file: UploadFile = File(...),
    member: ProjectMember = Depends(require_project_role(["ADMIN", "ANALYST"])),
    db: Session = Depends(get_db),
):
    """Upload a document to a project. Only ADMIN and ANALYST can upload."""
    # verify project exists
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")

    # create project subfolder
    project_dir = os.path.join(STORAGE_DIR, str(project_id))
    os.makedirs(project_dir, exist_ok=True)

    # unique storage key
    ext = os.path.splitext(file.filename)[1] if file.filename else ""
    storage_filename = f"{uuid.uuid4().hex}{ext}"
    storage_key = f"{project_id}/{storage_filename}"
    file_path = os.path.join(project_dir, storage_filename)

    # save file to disk
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # determine version (increment if same filename exists)
    latest = (
        db.query(Document)
        .filter(Document.project_id == project_id, Document.filename == file.filename)
        .order_by(Document.version.desc())
        .first()
    )
    version = (latest.version + 1) if latest else 1

    doc = Document(
        project_id=project_id,
        filename=file.filename,
        file_type=file.content_type,
        version=version,
        storage_key=storage_key,
        uploaded_by=member.user_id,
        status="UPLOADED",
    )
    db.add(doc)
    db.flush()

    audit = AuditEvent(
        project_id=project_id,
        document_id=doc.id,
        action="UPLOAD",
        actor_id=member.user_id,
        meta_json=json.dumps({"filename": file.filename, "version": version}),
    )
    db.add(audit)
    db.commit()
    db.refresh(doc)

    return {
        "msg": "Document uploaded",
        "document_id": doc.id,
        "filename": doc.filename,
        "version": doc.version,
    }


# ── List documents ───────────────────────────────────────

@router.get("/projects/{project_id}/documents")
def list_documents(
    project_id: int,
    member: ProjectMember = Depends(require_project_role(["ADMIN", "ANALYST", "VIEWER"])),
    db: Session = Depends(get_db),
):
    """List all documents in a project."""
    docs = (
        db.query(Document)
        .filter(Document.project_id == project_id)
        .order_by(Document.uploaded_at.desc())
        .all()
    )
    return [
        {
            "id": d.id,
            "filename": d.filename,
            "file_type": d.file_type,
            "version": d.version,
            "uploaded_by": d.uploaded_by,
            "uploaded_at": d.uploaded_at.isoformat() if d.uploaded_at else None,
            "status": d.status,
        }
        for d in docs
    ]


# ── Download ─────────────────────────────────────────────

@router.get("/documents/{doc_id}/download")
def download_document(
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Download a document by ID. User must be a member of the document's project."""
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")

    # check membership
    member = (
        db.query(ProjectMember)
        .filter(
            ProjectMember.project_id == doc.project_id,
            ProjectMember.user_id == current_user.id,
        )
        .first()
    )
    if not member:
        raise HTTPException(403, "You are not a member of this project")

    file_path = os.path.join(STORAGE_DIR, doc.storage_key)
    if not os.path.exists(file_path):
        raise HTTPException(404, "File not found on server")

    # audit
    audit = AuditEvent(
        project_id=doc.project_id,
        document_id=doc.id,
        action="DOWNLOAD",
        actor_id=current_user.id,
        meta_json=json.dumps({"filename": doc.filename}),
    )
    db.add(audit)
    db.commit()

    return FileResponse(
        path=file_path,
        filename=doc.filename,
        media_type=doc.file_type or "application/octet-stream",
    )
