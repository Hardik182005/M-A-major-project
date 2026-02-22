import os
import hashlib
import shutil
import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Request, Query, BackgroundTasks
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.config import settings
from app.auth.service import get_current_user
from app.auth.rbac import require_project_role, require_min_role
from app.models.user import User
from app.models.project import Project
from app.models.project_member import ProjectMember
from app.models.document import Document
from app.models.processing import ProcessingJob
from app.services.audit import log_audit
from app.workers.pipeline import pipeline_worker

router = APIRouter(tags=["Documents"])

STORAGE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), settings.STORAGE_DIR)
os.makedirs(STORAGE_DIR, exist_ok=True)


def _compute_sha256(file_path: str) -> str:
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


# ── Schemas ──────────────────────────────────────────────

class InitiateUploadRequest(BaseModel):
    filename: str
    file_type: Optional[str] = None


class LockRequest(BaseModel):
    reason: Optional[str] = None


# ── Step 1: Initiate upload (staged) ─────────────────────

@router.post("/projects/{project_id}/documents/initiate-upload", status_code=201)
def initiate_upload(
    project_id: int,
    data: InitiateUploadRequest,
    request: Request,
    member: ProjectMember = Depends(require_min_role("ANALYST")),
    db: Session = Depends(get_db),
):
    """
    Step 1 of 2-step upload: reserves a document record with status=UPLOADING.
    Returns doc_id and storage_key. Client then uploads the file.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")

    # find existing doc_key or create new
    latest = (
        db.query(Document)
        .filter(
            Document.project_id == project_id,
            Document.filename == data.filename,
            Document.is_deleted == False,  # noqa: E712
        )
        .order_by(Document.version.desc())
        .first()
    )

    if latest and latest.is_locked:
        raise HTTPException(423, f"Document '{data.filename}' is locked and cannot be overwritten.")

    doc_key = latest.doc_key if latest else uuid.uuid4().hex[:16]
    version = (latest.version + 1) if latest else 1

    storage_key = f"{project_id}/{doc_key}/v{version}/{data.filename}"

    doc = Document(
        project_id=project_id,
        doc_key=doc_key,
        filename=data.filename,
        file_type=data.file_type,
        version=version,
        is_latest=False,  # will be set to True on complete
        storage_provider=settings.STORAGE_PROVIDER,
        storage_key=storage_key,
        uploaded_by=member.user_id,
        status="UPLOADING",
    )
    db.add(doc)
    db.flush()

    log_audit(db, "INITIATE_UPLOAD", member.user_id,
              project_id=project_id, document_id=doc.id,
              ip_address=request.client.host,
              filename=data.filename, version=version, doc_key=doc_key)
    db.commit()
    db.refresh(doc)

    return {
        "document_id": doc.id,
        "doc_key": doc.doc_key,
        "version": doc.version,
        "storage_key": doc.storage_key,
        "status": "UPLOADING",
    }


# ── Step 2: Complete upload (validate + finalize) ────────

@router.post("/projects/{project_id}/documents/{doc_id}/complete-upload")
def complete_upload(
    project_id: int,
    doc_id: int,
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    auto_process: bool = Query(True, description="Auto-process document with AI pipeline"),
    member: ProjectMember = Depends(require_min_role("ANALYST")),
    db: Session = Depends(get_db),
):
    """
    Step 2 of 2-step upload: receives the actual file, computes checksum,
    validates integrity, and marks the document as READY.
    """
    doc = db.query(Document).filter(
        Document.id == doc_id,
        Document.project_id == project_id,
        Document.status == "UPLOADING",
    ).first()
    if not doc:
        raise HTTPException(404, "Upload session not found or already completed")

    # build storage path
    storage_dir = os.path.join(STORAGE_DIR, str(project_id), doc.doc_key, f"v{doc.version}")
    os.makedirs(storage_dir, exist_ok=True)
    file_path = os.path.join(storage_dir, doc.filename)

    # save file
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # compute checksum + size
    checksum = _compute_sha256(file_path)
    file_size = os.path.getsize(file_path)

    # check for exact duplicate
    duplicate = (
        db.query(Document)
        .filter(
            Document.project_id == project_id,
            Document.checksum == checksum,
            Document.is_deleted == False,  # noqa: E712
            Document.status == "READY",
        )
        .first()
    )
    if duplicate:
        os.remove(file_path)
        doc.status = "FAILED"
        db.commit()
        raise HTTPException(
            409,
            f"Exact duplicate: identical to '{duplicate.filename}' v{duplicate.version} (id={duplicate.id})"
        )

    # mark previous versions as not latest
    db.query(Document).filter(
        Document.project_id == project_id,
        Document.doc_key == doc.doc_key,
        Document.is_latest == True,  # noqa: E712
    ).update({"is_latest": False})
    
    # finalize
    doc.checksum = checksum
    doc.file_size = file_size
    doc.file_type = file.content_type or doc.file_type
    doc.is_latest = True
    doc.status = "READY"

    log_audit(db, "UPLOAD_DOCUMENT", member.user_id,
              project_id=project_id, document_id=doc.id,
              ip_address=request.client.host,
              filename=doc.filename, version=doc.version,
              file_size=file_size, checksum=checksum, doc_key=doc.doc_key)
    db.commit()
    db.refresh(doc)

    # Auto-create processing job if enabled
    job = None
    if auto_process and settings.ENABLE_AUTO_PROCESSING:
        job = ProcessingJob(
            project_id=project_id,
            doc_id=doc.id,
            stage="QUEUED",
            progress=0,
            status="QUEUED",
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        
        # Run in background
        background_tasks.add_task(pipeline_worker.process_document, job.id)

    return {
        "msg": "Upload complete",
        "document_id": doc.id,
        "doc_key": doc.doc_key,
        "filename": doc.filename,
        "version": doc.version,
        "file_size": doc.file_size,
        "checksum": doc.checksum,
        "status": doc.status,
        "auto_processing": auto_process and settings.ENABLE_AUTO_PROCESSING,
        "job_id": job.id if job else None,
    }


# ── Quick upload (1-step, backwards-compatible) ──────────

@router.post("/projects/{project_id}/documents/upload", status_code=201)
def upload_document(
    project_id: int,
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    auto_process: bool = Query(True, description="Auto-process document with AI pipeline"),
    member: ProjectMember = Depends(require_min_role("ANALYST")),
    db: Session = Depends(get_db),
):
    """
    One-step upload (convenience). For production, use the 2-step flow.
    Handles versioning, checksum, and duplicate detection.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")

    safe_filename = file.filename or "unnamed"

    # find existing doc_key
    latest = (
        db.query(Document)
        .filter(
            Document.project_id == project_id,
            Document.filename == safe_filename,
            Document.is_deleted == False,  # noqa: E712
        )
        .order_by(Document.version.desc())
        .first()
    )

    if latest and latest.is_locked:
        raise HTTPException(423, f"Document '{safe_filename}' is locked.")

    doc_key = latest.doc_key if latest else uuid.uuid4().hex[:16]
    version = (latest.version + 1) if latest else 1

    # storage path
    storage_dir = os.path.join(STORAGE_DIR, str(project_id), doc_key, f"v{version}")
    os.makedirs(storage_dir, exist_ok=True)
    file_path = os.path.join(storage_dir, safe_filename)
    storage_key = f"{project_id}/{doc_key}/v{version}/{safe_filename}"

    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    checksum = _compute_sha256(file_path)
    file_size = os.path.getsize(file_path)

    # duplicate check
    dup = (
        db.query(Document)
        .filter(
            Document.project_id == project_id,
            Document.checksum == checksum,
            Document.is_deleted == False,  # noqa: E712
            Document.status == "READY",
        )
        .first()
    )
    if dup:
        os.remove(file_path)
        raise HTTPException(409, f"Duplicate: identical to '{dup.filename}' v{dup.version}")

    # mark old versions
    if latest:
        db.query(Document).filter(
            Document.project_id == project_id,
            Document.doc_key == doc_key,
            Document.is_latest == True,  # noqa: E712
        ).update({"is_latest": False})

    doc = Document(
        project_id=project_id,
        doc_key=doc_key,
        filename=safe_filename,
        file_type=file.content_type,
        file_size=file_size,
        version=version,
        is_latest=True,
        checksum=checksum,
        storage_provider=settings.STORAGE_PROVIDER,
        storage_key=storage_key,
        uploaded_by=member.user_id,
        status="READY",
    )
    db.add(doc)
    db.flush()

    log_audit(db, "UPLOAD_DOCUMENT", member.user_id,
              project_id=project_id, document_id=doc.id,
              ip_address=request.client.host,
              filename=safe_filename, version=version,
              file_size=file_size, checksum=checksum, doc_key=doc_key)
    db.commit()
    db.refresh(doc)

    # Auto-create processing job if enabled
    job = None
    if auto_process and settings.ENABLE_AUTO_PROCESSING:
        job = ProcessingJob(
            project_id=project_id,
            doc_id=doc.id,
            stage="QUEUED",
            progress=0,
            status="QUEUED",
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        
        # Run in background
        background_tasks.add_task(pipeline_worker.process_document, job.id)

    return {
        "msg": "Document uploaded",
        "document_id": doc.id,
        "doc_key": doc.doc_key,
        "filename": doc.filename,
        "version": doc.version,
        "file_size": doc.file_size,
        "checksum": doc.checksum,
        "status": doc.status,
        "auto_processing": auto_process and settings.ENABLE_AUTO_PROCESSING,
        "job_id": job.id if job else None,
    }


# ── List documents (with search + filters + pagination) ──

@router.get("/projects/{project_id}/documents")
def list_documents(
    project_id: int,
    # filters
    filename: Optional[str] = Query(None, description="Search by filename (partial match)"),
    uploaded_by: Optional[int] = Query(None, description="Filter by uploader user ID"),
    file_type: Optional[str] = Query(None, description="Filter by MIME type"),
    status: Optional[str] = Query(None, description="Filter by status: READY, UPLOADING, FAILED"),
    doc_key: Optional[str] = Query(None, description="Filter by doc_key"),
    show_all_versions: bool = Query(False, description="Show all versions, not just latest"),
    include_deleted: bool = Query(False, description="Include soft-deleted docs (Admin only)"),
    # pagination
    sort_by: str = Query("uploaded_at", description="Sort by: uploaded_at, filename, file_size, version"),
    sort_order: str = Query("desc", description="asc or desc"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    # auth
    member: ProjectMember = Depends(require_min_role("AUDITOR")),
    db: Session = Depends(get_db),
):
    """
    List documents with full search, filtering, sorting, and pagination.
    Soft-deleted docs are hidden unless include_deleted=true (Admin+ only).
    """
    query = db.query(Document).filter(Document.project_id == project_id)

    # deleted filter
    if include_deleted:
        if member.role not in ("OWNER", "ADMIN"):
            raise HTTPException(403, "Only Admin+ can view deleted documents")
    else:
        query = query.filter(Document.is_deleted == False)  # noqa: E712

    # only READY by default (hide UPLOADING/FAILED unless asked)
    if status:
        query = query.filter(Document.status == status)
    else:
        query = query.filter(Document.status == "READY")

    if not show_all_versions:
        query = query.filter(Document.is_latest == True)  # noqa: E712

    if filename:
        query = query.filter(Document.filename.ilike(f"%{filename}%"))
    if uploaded_by:
        query = query.filter(Document.uploaded_by == uploaded_by)
    if file_type:
        query = query.filter(Document.file_type.ilike(f"%{file_type}%"))
    if doc_key:
        query = query.filter(Document.doc_key == doc_key)

    total = query.count()

    # sorting
    sort_column = getattr(Document, sort_by, Document.uploaded_at)
    if sort_order == "asc":
        query = query.order_by(sort_column.asc())
    else:
        query = query.order_by(sort_column.desc())

    docs = query.offset(offset).limit(limit).all()

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "documents": [
            {
                "id": d.id,
                "doc_key": d.doc_key,
                "filename": d.filename,
                "file_type": d.file_type,
                "file_size": d.file_size,
                "version": d.version,
                "is_latest": d.is_latest,
                "checksum": d.checksum,
                "status": d.status,
                "is_locked": d.is_locked,
                "lock_reason": d.lock_reason,
                "is_deleted": d.is_deleted,
                "uploaded_by": d.uploaded_by,
                "uploaded_at": d.uploaded_at.isoformat() if d.uploaded_at else None,
                "storage_provider": d.storage_provider,
            }
            for d in docs
        ],
    }


# ── Version history ──────────────────────────────────────

@router.get("/projects/{project_id}/documents/{doc_key}/versions")
def list_document_versions(
    project_id: int,
    doc_key: str,
    member: ProjectMember = Depends(require_min_role("AUDITOR")),
    db: Session = Depends(get_db),
):
    versions = (
        db.query(Document)
        .filter(
            Document.project_id == project_id,
            Document.doc_key == doc_key,
            Document.is_deleted == False,  # noqa: E712
        )
        .order_by(Document.version.desc())
        .all()
    )
    if not versions:
        raise HTTPException(404, "Document not found")

    return [
        {
            "id": v.id,
            "version": v.version,
            "is_latest": v.is_latest,
            "filename": v.filename,
            "file_size": v.file_size,
            "checksum": v.checksum,
            "status": v.status,
            "is_locked": v.is_locked,
            "uploaded_by": v.uploaded_by,
            "uploaded_at": v.uploaded_at.isoformat() if v.uploaded_at else None,
        }
        for v in versions
    ]


# ── Download ─────────────────────────────────────────────

@router.get("/documents/{doc_id}/download")
def download_document(
    doc_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Download a document. User must be a project member (VIEWER+)."""
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")
    if doc.is_deleted:
        raise HTTPException(410, "Document has been deleted")
    if doc.status != "READY":
        raise HTTPException(400, f"Document is not ready (status: {doc.status})")

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

    log_audit(db, "DOWNLOAD_DOCUMENT", current_user.id,
              project_id=doc.project_id, document_id=doc.id,
              ip_address=request.client.host,
              filename=doc.filename, version=doc.version)
    db.commit()

    return FileResponse(
        path=file_path,
        filename=doc.filename,
        media_type=doc.file_type or "application/octet-stream",
    )


# ── Soft Delete (Admin+) ────────────────────────────────

@router.delete("/projects/{project_id}/documents/{doc_id}")
def delete_document(
    project_id: int,
    doc_id: int,
    request: Request,
    member: ProjectMember = Depends(require_min_role("ADMIN")),
    db: Session = Depends(get_db),
):
    """Soft-delete a document. Admin+ only. Locked docs cannot be deleted."""
    doc = db.query(Document).filter(
        Document.id == doc_id, Document.project_id == project_id
    ).first()
    if not doc:
        raise HTTPException(404, "Document not found")
    if doc.is_deleted:
        raise HTTPException(410, "Already deleted")
    if doc.is_locked:
        raise HTTPException(423, "Document is locked (legal hold). Unlock before deleting.")

    doc.is_deleted = True
    doc.deleted_at = datetime.utcnow()
    doc.deleted_by = member.user_id
    doc.status = "DELETED"

    log_audit(db, "DELETE_DOCUMENT", member.user_id,
              project_id=project_id, document_id=doc.id,
              ip_address=request.client.host,
              filename=doc.filename, version=doc.version)
    db.commit()
    return {"msg": "Document deleted (soft)", "document_id": doc.id}


# ── Restore (Admin+) ────────────────────────────────────

@router.post("/projects/{project_id}/documents/{doc_id}/restore")
def restore_document(
    project_id: int,
    doc_id: int,
    request: Request,
    member: ProjectMember = Depends(require_min_role("ADMIN")),
    db: Session = Depends(get_db),
):
    doc = db.query(Document).filter(
        Document.id == doc_id, Document.project_id == project_id
    ).first()
    if not doc:
        raise HTTPException(404, "Document not found")
    if not doc.is_deleted:
        raise HTTPException(400, "Document is not deleted")

    doc.is_deleted = False
    doc.deleted_at = None
    doc.deleted_by = None
    doc.status = "READY"

    log_audit(db, "RESTORE_DOCUMENT", member.user_id,
              project_id=project_id, document_id=doc.id,
              ip_address=request.client.host, filename=doc.filename)
    db.commit()
    return {"msg": "Document restored", "document_id": doc.id}


# ── Lock / Unlock (Legal Hold — Owner/Admin only) ───────

@router.post("/projects/{project_id}/documents/{doc_id}/lock")
def lock_document(
    project_id: int,
    doc_id: int,
    data: LockRequest,
    request: Request,
    member: ProjectMember = Depends(require_min_role("ADMIN")),
    db: Session = Depends(get_db),
):
    """Lock a document (legal hold). Prevents deletion and version overwrite."""
    doc = db.query(Document).filter(
        Document.id == doc_id, Document.project_id == project_id
    ).first()
    if not doc:
        raise HTTPException(404, "Document not found")
    if doc.is_locked:
        raise HTTPException(400, "Document is already locked")

    doc.is_locked = True
    doc.locked_by = member.user_id
    doc.locked_at = datetime.utcnow()
    doc.lock_reason = data.reason

    log_audit(db, "LOCK_DOCUMENT", member.user_id,
              project_id=project_id, document_id=doc.id,
              ip_address=request.client.host,
              filename=doc.filename, reason=data.reason)
    db.commit()
    return {"msg": "Document locked", "document_id": doc.id, "reason": data.reason}


@router.post("/projects/{project_id}/documents/{doc_id}/unlock")
def unlock_document(
    project_id: int,
    doc_id: int,
    request: Request,
    member: ProjectMember = Depends(require_project_role(["OWNER"])),
    db: Session = Depends(get_db),
):
    """Unlock a document. OWNER only (since legal hold is critical)."""
    doc = db.query(Document).filter(
        Document.id == doc_id, Document.project_id == project_id
    ).first()
    if not doc:
        raise HTTPException(404, "Document not found")
    if not doc.is_locked:
        raise HTTPException(400, "Document is not locked")

    doc.is_locked = False
    doc.locked_by = None
    doc.locked_at = None
    doc.lock_reason = None

    log_audit(db, "UNLOCK_DOCUMENT", member.user_id,
              project_id=project_id, document_id=doc.id,
              ip_address=request.client.host, filename=doc.filename)
    db.commit()
    return {"msg": "Document unlocked", "document_id": doc.id}
