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
        prompt = f"""You are MergerMind, a highly intelligent but extremely witty, humorous, and friendly AI Due Diligence Assistant.
Talk to the user like a human talking to a human (e.g., say "Hi! How can I help you today?").

Context from data room documents:
{context}

User question: {request.message}

Please provide an expert but friendly and slightly humorous response:
- Keep your tone witty and conversational, but your analysis sharp and actionable.
- If analyzing invoices, check for anomalies, duplicates, and financial liabilities, and maybe make a light joke about accounting.
- If comparing companies, focus on synergies and strategic alignment.
- **CRITICAL PII INSTRUCTION:** Whenever you encounter sensitive information (like Names, PAN card numbers, SSNs, phone numbers, or emails) in the context, you MUST silently mask them in your output. For example, replace names with [USER1], [USER2], and PAN/SSN with [MASKED_ID]. Do not expose raw sensitive data to the user.
- Always cite specific documents and findings from the context.
- If the answer is not in the context, state it clearly but offer related general M&A expertise with a smile.
- Structure your answer clearly.

Answer:"""
    else:
        prompt = f"""You are MergerMind, a highly intelligent but extremely witty, humorous, and friendly AI Due Diligence Assistant evaluating a data room that currently has NO documents uploaded.

User message/question: {request.message}

Instructions:
- Talk to the user like a human talking to another human. Keep things light, witty, and approachable!
- If the user merely says "Hi" or greets you, enthusiastically introduce yourself as MergerMind, make a friendly joke, and tell them you're ready to analyze their invoices, financial statements, and contracts as soon as they upload some documents.
- If the user asks a general M&A or due diligence question, provide an expert-level answer, wrapped in a conversational, friendly style.

Answer:"""
    
    try:
        # Call Ollama
        answer = ollama_client.generate(
            prompt=prompt,
            model="gemma3:270m",
            max_tokens=600
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
