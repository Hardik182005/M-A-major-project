"""
Reports API Router
Generate and manage AI-powered due diligence reports
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Optional
from datetime import datetime
import uuid
import json

from ..db import get_db
from ..auth.dependencies import get_current_user
from ..models.user import User
from ..models.document import Document
from ..models.project import Project
from ..models.project_member import ProjectMember
from ..models.processing import (
    ProcessingJob, DocumentText, PIIEntity, 
    DocumentClassification, DocumentStructured, Finding
)

# In-memory storage for generated reports
_generated_reports = {}

router = APIRouter(prefix="/reports", tags=["reports"])


def check_project_access(project_id: int, user: User, db: Session):
    """Check if user has access to the project"""
    # Check if owner
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.created_by == user.id
    ).first()
    
    if project:
        return project
    
    # Check if member
    membership = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == user.id
    ).first()
    
    if not membership:
        raise HTTPException(status_code=403, detail="No access to this project")
    
    return db.query(Project).filter(Project.id == project_id).first()


@router.get("/project/{project_id}")
async def get_project_reports(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all reports for a project"""
    # Verify project access
    project = check_project_access(project_id, current_user, db)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get findings summary for the project
    findings = db.query(Finding).filter(Finding.project_id == project_id).all()
    documents = db.query(Document).filter(Document.project_id == project_id).all()
    
    # Generate a "virtual" report based on current analysis state
    total_docs = len(documents)
    processed_docs = len([d for d in documents if d.status == 'READY'])
    high_risk_findings = len([f for f in findings if f.severity == 'HIGH'])
    medium_risk_findings = len([f for f in findings if f.severity == 'MEDIUM'])
    low_risk_findings = len([f for f in findings if f.severity == 'LOW'])
    
    # Calculate overall risk score
    risk_score = 0
    if total_docs > 0:
        risk_score = min(100, (high_risk_findings * 20) + (medium_risk_findings * 10) + (low_risk_findings * 5))
    
    # Determine risk level
    if risk_score >= 70:
        risk_level = "HIGH"
    elif risk_score >= 40:
        risk_level = "MEDIUM"
    else:
        risk_level = "LOW"
    
    # Generate report
    report = {
        "report_id": f"rpt_{project_id}_{datetime.utcnow().strftime('%Y%m%d')}",
        "name": f"Due Diligence Report - {project.name}",
        "project_name": project.name,
        "created_at": project.created_at.isoformat() if project.created_at else datetime.utcnow().isoformat(),
        "doc_count": total_docs,
        "processed_count": processed_docs,
        "risk_level": risk_level,
        "risk_score": risk_score,
        "status": "Complete" if processed_docs > 0 else "Pending",
        "findings_count": {
            "high": high_risk_findings,
            "medium": medium_risk_findings,
            "low": low_risk_findings
        },
        "summary": generate_executive_summary(project, findings, documents, use_llm=False),
        "findings": [
            {
                "id": f.id,
                "category": f.category,
                "type": f.type,
                "severity": f.severity,
                "description": f.description,
                "confidence": f.confidence,
                "evidence": f.evidence_quote
            }
            for f in findings
        ],
        "risk_breakdown": {
            "financial": calculate_category_risk(findings, "FINANCIAL"),
            "legal": calculate_category_risk(findings, "LEGAL"),
            "operational": calculate_category_risk(findings, "OPERATIONAL"),
            "compliance": calculate_category_risk(findings, "COMPLIANCE")
        }
    }
    
    project_reports = _generated_reports.get(project_id, [])
    all_reports = [report] + project_reports
    
    return {
        "reports": all_reports,
        "current_report": all_reports[0]
    }


@router.post("/project/{project_id}/generate")
async def generate_report(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate a new AI report for the project"""
    # Verify project access
    project = check_project_access(project_id, current_user, db)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get all data
    findings = db.query(Finding).filter(Finding.project_id == project_id).all()
    documents = db.query(Document).filter(Document.project_id == project_id).all()
    classifications = db.query(DocumentClassification).join(Document).filter(Document.project_id == project_id).all()
    
    # Generate comprehensive report
    report = {
        "report_id": f"rpt_{project_id}_{uuid.uuid4().hex[:8]}",
        "name": f"AI Due Diligence Report - {project.name}",
        "project_name": project.name,
        "created_at": datetime.utcnow().isoformat(),
        "generated_by": current_user.email,
        "doc_count": len(documents),
        "processed_count": len(documents),
        "status": "Complete",
        "risk_level": "UNKNOWN",
        "risk_score": 0,
        "findings_count": len(findings),
        "summary": generate_executive_summary(project, findings, documents, use_llm=True),
        "findings": [
            {
                "id": f.id,
                "category": f.category,
                "type": f.type,
                "severity": f.severity,
                "description": f.description,
                "confidence": f.confidence,
                "evidence": f.evidence_quote
            }
            for f in findings
        ]
    }
    
    # Calculate overall risk score
    high_risk_findings = len([f for f in findings if f.severity == 'HIGH'])
    medium_risk_findings = len([f for f in findings if f.severity == 'MEDIUM'])
    low_risk_findings = len([f for f in findings if f.severity == 'LOW'])
    
    risk_score = 0
    if len(documents) > 0:
        risk_score = min(100, (high_risk_findings * 20) + (medium_risk_findings * 10) + (low_risk_findings * 5))
    report["risk_score"] = risk_score
    
    if risk_score >= 70:
        report["risk_level"] = "HIGH"
    elif risk_score >= 40:
        report["risk_level"] = "MEDIUM"
    else:
        report["risk_level"] = "LOW"
    
    report["risk_breakdown"] = {
        "financial": calculate_category_risk(findings, "FINANCIAL"),
        "legal": calculate_category_risk(findings, "LEGAL"),
        "operational": calculate_category_risk(findings, "OPERATIONAL"),
        "compliance": calculate_category_risk(findings, "COMPLIANCE")
    }

    if project_id not in _generated_reports:
        _generated_reports[project_id] = []
    _generated_reports[project_id].insert(0, report)
    
    return report


@router.get("/project/{project_id}/summary")
async def get_report_summary(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get executive summary for a project"""
    project = check_project_access(project_id, current_user, db)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    findings = db.query(Finding).filter(Finding.project_id == project_id).all()
    documents = db.query(Document).filter(Document.project_id == project_id).all()
    
    return {
        "project_name": project.name,
        "summary": generate_executive_summary(project, findings, documents),
        "risk_breakdown": {
            "financial": calculate_category_risk(findings, "FINANCIAL"),
            "legal": calculate_category_risk(findings, "LEGAL"),
            "operational": calculate_category_risk(findings, "OPERATIONAL"),
            "compliance": calculate_category_risk(findings, "COMPLIANCE")
        },
        "verdict": get_overall_verdict(findings, documents)
    }


from app.services.ollama_client import ollama_client

def generate_executive_summary(project, findings, documents, use_llm=True):
    """Generate an AI-powered executive summary based on findings"""
    if not documents:
        return "No documents have been uploaded for analysis. Upload documents to generate an AI-powered due diligence report."
    
    if not findings:
        return f"Analysis of {len(documents)} document(s) completed. No significant risk factors were identified. The AI model found no critical issues requiring immediate attention."
    
    high_severity = [f for f in findings if f.severity == 'HIGH' or f.severity == 'CRITICAL']
    medium_severity = [f for f in findings if f.severity == 'MEDIUM']
    
    if not use_llm:
        summary_parts = [f"Analysis of {len(documents)} document(s) for project '{project.name}' has identified {len(findings)} finding(s)."]
        if high_severity:
            summary_parts.append(f"**{len(high_severity)} HIGH severity issue(s)** require immediate attention.")
        if medium_severity:
            summary_parts.append(f"{len(medium_severity)} MEDIUM severity issue(s) were also identified.")
        return " ".join(summary_parts)
    
    # Construct input for AI context
    findings_context = ""
    for idx, f in enumerate(high_severity[:5]):  # Top 5 high-risk issues
        findings_context += f"- High Risk ({f.category}): {f.description[:200]}\n"
    
    for idx, f in enumerate(medium_severity[:3]):
        findings_context += f"- Medium Risk ({f.category}): {f.description[:100]}\n"
        
    prompt = f"""You are a top-tier Wall Street M&A Partner. Write a cohesive, extremely accurate, and professional executive due diligence summary (max 3 paragraphs) for Project '{project.name}'.

Data Room Stats:
- Documents processed: {len(documents)}
- Total risks flagged: {len(findings)}
- Critical/High severity gaps: {len(high_severity)}
- Medium severity issues: {len(medium_severity)}

Verified Major Findings Context:
{findings_context}

INSTRUCTIONS for maximum accuracy:
1. Do not use filler introductions or generic platitudes.
2. Formulate a definitive, data-driven assessment.
3. Weigh the High/Critical severity issues heavily.
4. If Critical risks exist, state explicitly that the deal faces material contingencies.
5. If no major risks exist, state the target presents clean operational health in the processed scope.

Begin Executive Summary:"""

    try:
        from app.config import settings
        # Call Ollama for dynamic summary generation
        summary = ollama_client.generate(
            prompt=prompt,
            model=settings.OLLAMA_ANALYSIS_MODEL,
            max_tokens=600
        )
        if not summary or summary.startswith("Error:"):
            raise ValueError("Ollama failed to generate summary")
        return summary
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Failed to generate LLM summary: {e}")
        # Fallback to programmatic generation
        summary_parts = [f"Analysis of {len(documents)} document(s) for project '{project.name}' has identified {len(findings)} finding(s)."]
        
        if high_severity:
            summary_parts.append(f"**{len(high_severity)} HIGH severity issue(s)** require immediate attention.")
            for f in high_severity[:3]:
                summary_parts.append(f"- {f.category}: {f.description[:100]}...")
        
        if medium_severity:
            summary_parts.append(f"{len(medium_severity)} MEDIUM severity issue(s) were also identified.")
        
        return " ".join(summary_parts)


def calculate_category_risk(findings, category):
    """Calculate risk percentage for a category"""
    score = 0
    for f in findings:
        cat = f.category.upper() if f.category else ""
        
        # Map some AI categories to the fundamental 4 buckets
        if category == "OPERATIONAL" and cat in ["OPERATIONAL", "RISK", "ANOMALY", "TREND"]:
            match = True
        elif category == "LEGAL" and cat in ["LEGAL", "IP_ISSUE"]:
            match = True
        elif category == "FINANCIAL" and cat == "FINANCIAL":
            match = True
        elif category == "COMPLIANCE" and cat == "COMPLIANCE":
            match = True
        elif category == cat:
            match = True
        else:
            match = False
            
        if match:
            if f.severity == 'CRITICAL':
                score += 50
            elif f.severity == 'HIGH':
                score += 30
            elif f.severity == 'MEDIUM':
                score += 15
            else:
                score += 5
    
    return min(100, score)


def get_overall_verdict(findings, documents):
    """Get overall investment verdict"""
    if not documents:
        return {
            "verdict": "PENDING_REVIEW",
            "label": "Pending Review",
            "confidence": 0,
            "message": "Upload documents to begin analysis"
        }
    
    high_count = len([f for f in findings if f.severity == 'HIGH'])
    medium_count = len([f for f in findings if f.severity == 'MEDIUM'])
    
    if high_count >= 3:
        return {
            "verdict": "HIGH_RISK",
            "label": "High Risk",
            "confidence": 0.85,
            "message": "Multiple critical issues identified. Recommend detailed review before proceeding."
        }
    elif high_count >= 1:
        return {
            "verdict": "PROCEED_WITH_CAUTION",
            "label": "Proceed with Caution",
            "confidence": 0.75,
            "message": "Some critical issues identified. Review findings before proceeding."
        }
    elif medium_count >= 3:
        return {
            "verdict": "MODERATE_RISK",
            "label": "Moderate Risk",
            "confidence": 0.70,
            "message": "Several moderate issues identified. Due diligence recommended."
        }
    elif len(findings) > 0:
        return {
            "verdict": "LOW_RISK",
            "label": "Low Risk",
            "confidence": 0.80,
            "message": "Minor issues identified. Generally favorable for proceeding."
        }
    else:
        return {
            "verdict": "FAVORABLE",
            "label": "Favorable",
            "confidence": 0.90,
            "message": "No significant issues identified. Ready to proceed."
        }


def get_doc_type(doc_id, classifications):
    """Get document type from classifications"""
    for c in classifications:
        if c.doc_id == doc_id:
            return c.doc_type or "unknown"
    return "unknown"
