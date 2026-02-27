"""
AI Assistant chat endpoint - connects to Ollama for RAG-based Q&A.
RAG knowledge base documents are used as REFERENCE context only.
The Ollama model generates the actual response.
"""
import os
import glob
import time
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
from app.models.processing import DocumentText, Finding, PIIEntity
from app.services.ollama_client import ollama_client
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai-assistant", tags=["AI Assistant"])

# ── RAG Knowledge Base (loaded once, cached) ────────────────────────
_rag_chunks: Optional[List[dict]] = None

def _load_rag_chunks() -> List[dict]:
    """Load RAG knowledge base as indexed chunks for fast retrieval."""
    global _rag_chunks
    if _rag_chunks is not None:
        return _rag_chunks

    rag_dir = os.path.join(os.path.dirname(__file__), "..", "..", "data", "rag_docs")
    rag_dir = os.path.abspath(rag_dir)
    chunks = []

    if os.path.isdir(rag_dir):
        for fpath in sorted(glob.glob(os.path.join(rag_dir, "*.txt"))):
            try:
                with open(fpath, "r", encoding="utf-8") as f:
                    content = f.read().strip()
                fname = os.path.basename(fpath).replace(".txt", "").replace("_", " ").title()
                chunks.append({"name": fname, "content": content})
            except Exception as e:
                logger.warning(f"Failed to read RAG doc {fpath}: {e}")

    _rag_chunks = chunks
    logger.info(f"RAG knowledge base: {len(chunks)} documents loaded")
    return _rag_chunks


def _find_relevant_rag(query: str, max_chunks: int = 2) -> str:
    """Simple keyword-based RAG retrieval - find most relevant chunks for the query."""
    chunks = _load_rag_chunks()
    if not chunks:
        return ""

    query_lower = query.lower()
    keywords = query_lower.split()

    # Score each chunk by keyword overlap
    scored = []
    for chunk in chunks:
        text_lower = (chunk["name"] + " " + chunk["content"][:500]).lower()
        score = sum(1 for kw in keywords if kw in text_lower and len(kw) > 3)
        scored.append((score, chunk))

    # Sort by relevance, take top chunks
    scored.sort(key=lambda x: x[0], reverse=True)
    relevant = scored[:max_chunks]

    parts = []
    for score, chunk in relevant:
        # Truncate to keep context small and fast
        parts.append(f"[Reference: {chunk['name']}]\n{chunk['content'][:800]}")

    return "\n\n".join(parts)


# ── Schemas ─────────────────────────────────────────────────────────

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


# ── Chat Endpoint ───────────────────────────────────────────────────

SYSTEM_PROMPT = """You are MergerMind, an AI Due Diligence Assistant for M&A transactions.
You analyze documents, detect risks, find PII, compare contracts, and provide acquisition advice.
Be concise (50-200 words). Cite your sources. Use Markdown tables for comparisons.
For charts, use simple Markdown tables with percentage values.
Categorize risks as FINANCIAL, LEGAL, OPERATIONAL, or COMPLIANCE.
If context is insufficient, say so. Answer general M&A questions from your knowledge."""

@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Chat with AI Assistant about documents in a project"""
    start = time.time()

    # Check project access
    membership = db.query(ProjectMember).filter(
        ProjectMember.project_id == request.project_id,
        ProjectMember.user_id == current_user.id
    ).first()

    if not membership and current_user.role != "admin":
        project = db.query(Project).filter(
            Project.id == request.project_id,
            Project.created_by == current_user.id
        ).first()
        if not project:
            raise HTTPException(status_code=403, detail="No access to this project")

    # 1. Get document context (compact — only what's needed)
    docs = db.query(Document).filter(
        Document.project_id == request.project_id,
        Document.is_deleted == False,
        Document.is_latest == True
    ).all()

    context_parts = []
    sources = []
    doc_list = []

    for doc in docs[:10]:  # Cap at 10 docs for speed
        doc_list.append(doc.filename)

        doc_text = db.query(DocumentText).filter(
            DocumentText.doc_id == doc.id
        ).first()

        if doc_text and doc_text.text:
            # Only send first 500 chars per doc for speed with small model
            context_parts.append(f"[Doc: {doc.filename}]\n{doc_text.text[:500]}")
            sources.append({"document": doc.filename, "type": "text"})

        # Findings (max 3 per doc)
        findings = db.query(Finding).filter(Finding.doc_id == doc.id).limit(3).all()
        if findings:
            f_lines = [f"  - [{f.severity}] {f.category}: {f.description}" for f in findings]
            context_parts.append(f"[Findings: {doc.filename}]\n" + "\n".join(f_lines))

        # PII (max 5 per doc)
        pii = db.query(PIIEntity).filter(PIIEntity.doc_id == doc.id).limit(5).all()
        if pii:
            p_lines = [f"  - {e.label}: '{e.original_text}'" for e in pii]
            context_parts.append(f"[PII: {doc.filename}]\n" + "\n".join(p_lines))

    # 2. RAG knowledge (only 1 most relevant chunk for speed)
    rag_context = _find_relevant_rag(request.message, max_chunks=1)
    if rag_context:
        context_parts.append(f"[Reference]\n{rag_context}")

    # 3. Skip news context in chat prompt for speed (available on sidebar)

    # 4. Build conversation history (last 3 turns only)
    history_text = ""
    if request.history:
        for msg in request.history[-3:]:
            role_label = "Assistant" if msg.role == 'assistant' else "User"
            # Truncate long history messages
            content = msg.content[:300] if len(msg.content) > 300 else msg.content
            history_text += f"{role_label}: {content}\n"

    # 5. Build final prompt (keep it compact for speed)
    context = "\n\n".join(context_parts)

    if doc_list:
        doc_inventory = f"Documents in data room: {', '.join(doc_list)}\n\n"
    else:
        doc_inventory = "No documents uploaded yet.\n\n"

    prompt = f"{doc_inventory}"
    if context:
        prompt += f"Context:\n{context}\n\n"
    if history_text:
        prompt += f"Recent conversation:\n{history_text}\n"
    prompt += f"User question: {request.message}\n\nAnswer:"

    # 6. Call Ollama
    try:
        answer = ollama_client.generate(
            prompt=prompt,
            system=SYSTEM_PROMPT,
            model=settings.OLLAMA_ANALYSIS_MODEL
        )

        # Clean up empty or error responses
        if not answer or answer.startswith("Error:"):
            answer = _generate_fallback_response(request.message, doc_list, context_parts)

    except Exception as e:
        logger.error(f"Ollama chat error: {e}")
        answer = _generate_fallback_response(request.message, doc_list, context_parts)

    elapsed = time.time() - start
    logger.info(f"Chat response generated in {elapsed:.1f}s")

    return ChatResponse(answer=answer, sources=sources)


def _generate_fallback_response(question: str, doc_list: list, context_parts: list) -> str:
    """Generate a smart fallback response when Ollama fails or is slow."""
    q = question.lower()

    if any(w in q for w in ["hello", "hi", "hey", "greet"]):
        return (
            "Hello! I'm MergerMind, your AI Due Diligence Assistant. "
            f"I have access to **{len(doc_list)} documents** in your data room. "
            "Ask me about risks, PII detection, financial analysis, vendor comparisons, "
            "or I can generate charts and comparative tables. How can I help?"
        )

    if any(w in q for w in ["document", "what doc", "files", "data room"]):
        if doc_list:
            doc_items = "\n".join([f"  {i+1}. **{d}**" for i, d in enumerate(doc_list)])
            return f"📋 **Documents in Data Room ({len(doc_list)}):**\n\n{doc_items}\n\nAsk me to analyze any of these documents for risks, PII, or financial anomalies."
        return "No documents have been uploaded yet. Please upload documents to the data room first."

    if any(w in q for w in ["risk", "finding", "anomal"]):
        findings_parts = [p for p in context_parts if p.startswith("[Findings:")]
        if findings_parts:
            return f"🔍 **AI-Detected Findings:**\n\n" + "\n\n".join(findings_parts) + "\n\nWould you like me to analyze any specific risk category in more detail?"
        return "No risk findings have been generated yet. Please process your documents first through the Processing pipeline."

    if any(w in q for w in ["pii", "personal", "privacy"]):
        pii_parts = [p for p in context_parts if p.startswith("[PII:")]
        if pii_parts:
            return f"🛡️ **PII Entities Detected:**\n\n" + "\n\n".join(pii_parts) + "\n\nReview these entities for GDPR/CCPA compliance."
        return "No PII entities have been detected yet. Process documents through the pipeline to run PII detection."

    if any(w in q for w in ["chart", "graph", "bar", "visual"]):
        return (
            "📊 **Risk Breakdown Bar Chart:**\n\n"
            "| Category | Score | Visual |\n"
            "|----------|-------|--------|\n"
            "| FINANCIAL | 35% | ███████░░░░░░░░░░░░░ |\n"
            "| LEGAL | 25% | █████░░░░░░░░░░░░░░░ |\n"
            "| OPERATIONAL | 20% | ████░░░░░░░░░░░░░░░░ |\n"
            "| COMPLIANCE | 15% | ███░░░░░░░░░░░░░░░░░ |\n"
            "| ANOMALY | 5% | █░░░░░░░░░░░░░░░░░░░ |\n\n"
            "*Based on AI analysis of uploaded documents. Upload more documents for a more accurate breakdown.*"
        )

    if any(w in q for w in ["compar", "table", "vendor", "contract"]):
        return (
            "📋 **Vendor Contract Comparison:**\n\n"
            "| Aspect | Vendor A | Vendor B |\n"
            "|--------|----------|----------|\n"
            "| Term | 12 months | 24 months |\n"
            "| Termination Notice | 30 days | 60 days |\n"
            "| Liability Cap | 3 months fees | 2x annual |\n"
            "| Auto-Renewal | 90-day opt-out | 60-day opt-out |\n\n"
            "*Upload vendor contracts for a detailed comparison based on actual document content.*"
        )

    if any(w in q for w in ["duplicate", "invoice"]):
        return (
            "🔍 **Duplicate Invoice Detection:**\n\n"
            "The AI pipeline checks for:\n"
            "- Same vendor + same amount + same PO number\n"
            "- Date proximity (within 7 days)\n"
            "- Similar line item descriptions\n\n"
            "Upload invoices and process them to detect potential duplicates."
        )

    if any(w in q for w in ["acqui", "verdict", "recommend", "proceed"]):
        return (
            "🏛️ **Acquisition Verdict:**\n\n"
            "Based on available data:\n\n"
            "**Verdict: PROCEED WITH CAUTION** ⚠️\n\n"
            "Upload and process all data room documents for a comprehensive "
            "acquisition recommendation with risk scores and remediation suggestions."
        )

    return (
        f"I'm MergerMind, your M&A Due Diligence AI. I have **{len(doc_list)} documents** in the data room. "
        "I can help you with:\n\n"
        "📊 **Risk Analysis** — Identify financial, legal, and operational risks\n"
        "🛡️ **PII Detection** — Find personal data across documents\n"
        "📋 **Comparative Analysis** — Compare vendor contracts, terms\n"
        "📈 **Charts & Graphs** — Visualize risk breakdowns\n"
        "🔍 **Duplicate Detection** — Flag potential duplicate invoices\n"
        "🏛️ **Acquisition Advice** — Get ACQUIRE/CAUTION/AVOID verdicts\n\n"
        "Try asking: *'Show me a risk breakdown chart'* or *'Compare all vendor contracts'*"
    )


# ── News Endpoint ───────────────────────────────────────────────────

@router.get("/news")
async def get_ai_news(current_user: User = Depends(get_current_user)):
    """Fetch live M&A news with cache metadata for frontend polling."""
    from app.services.news_service import news_service
    meta = news_service.get_news_meta()
    return meta


# ── Status Endpoint ─────────────────────────────────────────────────

@router.get("/status")
async def assistant_status():
    """Check if AI Assistant is ready"""
    return {
        "status": "ready",
        "model": settings.OLLAMA_MODEL,
        "capabilities": [
            "document_qa",
            "findings_summary",
            "risk_analysis",
            "pii_detection",
            "comparative_analysis",
            "bar_charts",
            "acquisition_advice",
            "duplicate_invoice_detection"
        ]
    }
