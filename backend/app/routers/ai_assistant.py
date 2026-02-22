"""
AI Assistant chat endpoint - connects to Ollama for RAG-based Q&A
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
import logging

from app.db import get_db
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.models.project import Project
from app.models.project_member import ProjectMember
from app.models.document import Document
from app.models.processing import DocumentText, DocumentChunk, Finding
from app.services.ollama_client import ollama_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai-assistant", tags=["AI Assistant"])

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    project_id: int
    message: str
    history: Optional[List[ChatMessage]] = []

class ChatResponse(BaseModel):
    answer: str
    sources: Optional[List[dict]] = []

@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Chat with AI Assistant about documents in a project"""
    
    # Check project access
    membership = db.query(ProjectMember).filter(
        ProjectMember.project_id == request.project_id,
        ProjectMember.user_id == current_user.id
    ).first()
    
    if not membership:
        # Check if owner
        project = db.query(Project).filter(
            Project.id == request.project_id,
            Project.created_by == current_user.id
        ).first()
        if not project:
            raise HTTPException(status_code=403, detail="No access to this project")
    
    # Get document text and findings for RAG
    docs = db.query(Document).filter(
        Document.project_id == request.project_id,
        Document.is_deleted == False,
        Document.is_latest == True
    ).all()
    
    # Build context from document text
    context_parts = []
    sources = []
    
    for doc in docs:
        # Get extracted text
        doc_text = db.query(DocumentText).filter(
            DocumentText.doc_id == doc.id
        ).first()
        
        if doc_text and doc_text.text:
            text_preview = doc_text.text[:2000]  # Limit context size
            context_parts.append(f"Document: {doc.filename}\n{text_preview}")
            sources.append({
                "document": doc.filename,
                "type": "full_text"
            })
        
        # Get findings
        findings = db.query(Finding).filter(
            Finding.doc_id == doc.id
        ).all()
        
        if findings:
            findings_text = "\n".join([
                f"- {f.category}: {f.description}"
                for f in findings[:5]  # Limit findings
            ])
            context_parts.append(f"AI Findings for {doc.filename}:\n{findings_text}")
            sources.append({
                "document": doc.filename,
                "type": "findings"
            })
    
    # Build the prompt
    context = "\n\n---\n\n".join(context_parts)
    
    if context:
        system = """You are MergerMind, a highly intelligent AI Due Diligence Assistant.
Answer the user's question accurately using ONLY the context provided below.
If the context does not contain the answer, say "I don't have enough information to answer that based on the current documents." """
        prompt = f"Context from data room documents:\n{context}\n\nUser question: {request.message}"
    else:
        system = """You are MergerMind, a helpful AI Due Diligence Assistant. There are currently no documents in the data room.
Answer the user's question or greeting simply.
If they ask for analysis, politely tell them to upload documents first."""
        prompt = f"User question: {request.message}"
    
    try:
        # Call Ollama
        answer = ollama_client.generate(
            prompt=prompt,
            system=system
        )
    except Exception as e:
        logger.error(f"Ollama chat error: {e}")
        answer = f"I apologize, but I encountered an error processing your question: {str(e)}"
    
    return ChatResponse(
        answer=answer,
        sources=sources
    )

@router.get("/status")
async def assistant_status():
    """Check if AI Assistant is ready"""
    return {
        "status": "ready",
        "model": "gemma3:270m",
        "capabilities": ["document_qa", "findings_summary", "risk_analysis"]
    }
