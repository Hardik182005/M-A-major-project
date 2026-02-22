"""
Processing API endpoints for AI pipeline.
"""
import logging
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime

from app.db import get_db
from app.auth.service import get_current_user
from app.auth.rbac import require_project_role, require_min_role
from app.models.user import User
from app.models.project import Project
from app.models.project_member import ProjectMember
from app.models.document import Document
from app.models.processing import (
    ProcessingJob,
    DocumentText,
    PIIEntity,
    DocumentClassification,
    DocumentStructured,
    Finding,
)
from app.workers.pipeline import process_document_task

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Processing"])


# ── Schemas ─────────────────────────────────────────────────────────────

class ProcessDocumentRequest(BaseModel):
    doc_id: int
    force: bool = False  # Force reprocessing even if already processed


class ProcessingJobResponse(BaseModel):
    id: int
    project_id: int
    doc_id: int
    stage: str
    progress: int
    status: str
    eta_seconds: Optional[int]
    error_code: Optional[str]
    error_msg: Optional[str]
    created_at: str
    updated_at: str


class ClassificationResponse(BaseModel):
    doc_id: int
    doc_type: str
    sensitivity: str
    confidence: float
    tags: List[str]
    needs_vlm: bool


class PIIEntityResponse(BaseModel):
    id: int
    label: str
    original_text: str
    replacement: Optional[str]
    page: Optional[int]
    confidence: float
    detection_method: str


class StructuredDataResponse(BaseModel):
    id: int
    schema_type: str
    json_blob: dict
    confidence: float
    source_page: Optional[int]


class FindingResponse(BaseModel):
    id: int
    category: str
    type: Optional[str]
    severity: str
    status: str
    description: str
    evidence_page: Optional[int]
    evidence_quote: Optional[str]
    confidence: float


# ── Endpoints ───────────────────────────────────────────────────────────

@router.post("/projects/{project_id}/documents/{doc_id}/process")
def process_document(
    project_id: int,
    doc_id: int,
    background_tasks: BackgroundTasks,
    request: ProcessDocumentRequest = None,
    member: ProjectMember = Depends(require_min_role("ANALYST")),
    db: Session = Depends(get_db),
):
    """
    Start processing a document through the AI pipeline.
    Creates a processing job and runs it in background.
    """
    # Verify document exists
    doc = db.query(Document).filter(
        Document.id == doc_id,
        Document.project_id == project_id,
    ).first()
    if not doc:
        raise HTTPException(404, "Document not found")
    
    if doc.status != "READY":
        raise HTTPException(400, f"Document must be READY, currently: {doc.status}")
    
    # Check for existing job
    existing_job = db.query(ProcessingJob).filter(
        ProcessingJob.doc_id == doc_id,
        ProcessingJob.status.in_(["QUEUED", "PROCESSING"]),
    ).first()
    
    if existing_job and not (request and request.force):
        raise HTTPException(409, f"Document is already being processed (job {existing_job.id})")
    
    # Create processing job
    job = ProcessingJob(
        project_id=project_id,
        doc_id=doc_id,
        stage="QUEUED",
        progress=0,
        status="QUEUED",
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    
    # Run in background
    background_tasks.add_task(process_document_task, job.id)
    
    return {
        "msg": "Processing started",
        "job_id": job.id,
        "doc_id": doc_id,
    }


@router.get("/projects/{project_id}/processing-jobs", response_model=List[ProcessingJobResponse])
def list_processing_jobs(
    project_id: int,
    status: Optional[str] = None,
    member: ProjectMember = Depends(require_min_role("VIEWER")),
    db: Session = Depends(get_db),
):
    """
    List processing jobs for a project.
    """
    query = db.query(ProcessingJob).filter(ProcessingJob.project_id == project_id)
    
    if status:
        query = query.filter(ProcessingJob.status == status)
    
    jobs = query.order_by(ProcessingJob.created_at.desc()).limit(50).all()
    
    return [
        ProcessingJobResponse(
            id=job.id,
            project_id=job.project_id,
            doc_id=job.doc_id,
            stage=job.stage,
            progress=job.progress,
            status=job.status,
            eta_seconds=job.eta_seconds,
            error_code=job.error_code,
            error_msg=job.error_msg,
            created_at=job.created_at.isoformat() if job.created_at else None,
            updated_at=job.updated_at.isoformat() if job.updated_at else None,
        )
        for job in jobs
    ]


@router.get("/processing-jobs/{job_id}", response_model=ProcessingJobResponse)
def get_processing_job(
    job_id: int,
    member: ProjectMember = Depends(require_min_role("VIEWER")),
    db: Session = Depends(get_db),
):
    """
    Get details of a processing job.
    """
    job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
    if not job:
        raise HTTPException(404, "Processing job not found")
    
    # Verify member has access to project
    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == job.project_id,
        ProjectMember.user_id == member.user_id,
    ).first()
    if not member:
        raise HTTPException(403, "Not a member of this project")
    
    return ProcessingJobResponse(
        id=job.id,
        project_id=job.project_id,
        doc_id=job.doc_id,
        stage=job.stage,
        progress=job.progress,
        status=job.status,
        eta_seconds=job.eta_seconds,
        error_code=job.error_code,
        error_msg=job.error_msg,
        created_at=job.created_at.isoformat() if job.created_at else None,
        updated_at=job.updated_at.isoformat() if job.updated_at else None,
    )


@router.get("/documents/{doc_id}/classification", response_model=ClassificationResponse)
def get_document_classification(
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get document classification results.
    """
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")
    
    # Verify access
    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == doc.project_id,
        ProjectMember.user_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(403, "Not a member of this project")
    
    classification = db.query(DocumentClassification).filter(
        DocumentClassification.doc_id == doc_id,
    ).first()
    
    if not classification:
        raise HTTPException(404, "Classification not found - document may not have been processed yet")
    
    return ClassificationResponse(
        doc_id=classification.doc_id,
        doc_type=classification.doc_type,
        sensitivity=classification.sensitivity,
        confidence=classification.confidence,
        tags=classification.tags or [],
        needs_vlm=classification.needs_vlm,
    )


@router.get("/documents/{doc_id}/pii-entities", response_model=List[PIIEntityResponse])
def get_pii_entities(
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get PII entities detected in a document.
    """
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")
    
    # Verify access
    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == doc.project_id,
        ProjectMember.user_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(403, "Not a member of this project")
    
    entities = db.query(PIIEntity).filter(PIIEntity.doc_id == doc_id).all()
    
    return [
        PIIEntityResponse(
            id=entity.id,
            label=entity.label,
            original_text=entity.original_text,
            replacement=entity.replacement,
            page=entity.page,
            confidence=entity.confidence,
            detection_method=entity.detection_method,
        )
        for entity in entities
    ]


@router.get("/documents/{doc_id}/structured", response_model=List[StructuredDataResponse])
def get_structured_data(
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get structured data extracted from a document (via Donut VLM).
    """
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")
    
    # Verify access
    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == doc.project_id,
        ProjectMember.user_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(403, "Not a member of this project")
    
    structured = db.query(DocumentStructured).filter(DocumentStructured.doc_id == doc_id).all()
    
    return [
        StructuredDataResponse(
            id=s.id,
            schema_type=s.schema_type,
            json_blob=s.json_blob,
            confidence=s.confidence,
            source_page=s.source_page,
        )
        for s in structured
    ]


@router.get("/documents/{doc_id}/findings")
def get_findings(
    doc_id: int,
    category: Optional[str] = None,
    severity: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get AI-generated findings for a document.
    """
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")
    
    # Verify access
    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == doc.project_id,
        ProjectMember.user_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(403, "Not a member of this project")
    
    query = db.query(Finding).filter(Finding.doc_id == doc_id)
    
    if category:
        query = query.filter(Finding.category == category)
    if severity:
        query = query.filter(Finding.severity == severity)
    
    findings = query.order_by(Finding.severity.desc(), Finding.confidence.desc()).all()
    
    return {
        "findings": [
            {
                "id": finding.id,
                "category": finding.category,
                "type": finding.type,
                "severity": finding.severity,
                "status": finding.status,
                "description": finding.description,
                "evidence_page": finding.evidence_page,
                "evidence_quote": finding.evidence_quote,
                "confidence": finding.confidence,
            }
            for finding in findings
        ]
    }


@router.get("/projects/{project_id}/findings")
def get_project_findings(
    project_id: int,
    category: Optional[str] = None,
    severity: Optional[str] = None,
    status: Optional[str] = None,
    member: ProjectMember = Depends(require_min_role("VIEWER")),
    db: Session = Depends(get_db),
):
    """
    Get all findings for a project as a flat list.
    """
    query = db.query(Finding).filter(Finding.project_id == project_id)
    
    if category:
        query = query.filter(Finding.category == category)
    if severity:
        query = query.filter(Finding.severity == severity)
    if status:
        query = query.filter(Finding.status == status)
    
    findings = query.order_by(Finding.severity.desc(), Finding.created_at.desc()).all()
    
    flat_findings = []
    for finding in findings:
        doc = db.query(Document).filter(Document.id == finding.doc_id).first()
        flat_findings.append({
            "id": finding.id,
            "doc_id": finding.doc_id,
            "doc_name": doc.filename if doc else "Unknown",
            "category": finding.category,
            "type": finding.type,
            "severity": finding.severity,
            "status": finding.status,
            "description": finding.description,
            "confidence": finding.confidence,
        })
    
    return {"findings": flat_findings}


@router.patch("/findings/{finding_id}/status")
def update_finding_status(
    finding_id: int,
    status: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update finding status (CONFIRMED, DISMISSED, RESOLVED).
    """
    finding = db.query(Finding).filter(Finding.id == finding_id).first()
    if not finding:
        raise HTTPException(404, "Finding not found")
    
    # Verify access
    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == finding.project_id,
        ProjectMember.user_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(403, "Not a member of this project")
        
    if member.role not in ("OWNER", "ADMIN", "ANALYST"):
        raise HTTPException(403, "Insufficient permissions to update finding status")
    
    if status not in ("NEW", "CONFIRMED", "DISMISSED", "RESOLVED"):
        raise HTTPException(400, "Invalid status")
    
    finding.status = status
    finding.updated_at = datetime.utcnow()
    db.commit()
    
    return {"msg": "Finding status updated", "finding_id": finding_id, "status": status}


@router.get("/documents/{doc_id}/text")
def get_document_text(
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get extracted text from a document.
    """
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")
    
    # Verify access
    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == doc.project_id,
        ProjectMember.user_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(403, "Not a member of this project")
    
    text_record = db.query(DocumentText).filter(DocumentText.doc_id == doc_id).first()
    
    if not text_record:
        raise HTTPException(404, "Text not found - document may not have been processed yet")
    
    return {
        "doc_id": doc_id,
        "text": text_record.text,
        "pages_json": text_record.pages_json,
        "page_count": text_record.page_count,
        "char_count": text_record.char_count,
        "extraction_method": text_record.extraction_method,
        "extraction_quality": text_record.extraction_quality,
    }
