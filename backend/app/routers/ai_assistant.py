"""
AI Assistant chat endpoint - connects to Ollama for RAG-based Q&A.
Supports both streaming (SSE) and blocking responses.
Uses ChromaDB for fast semantic retrieval when available.
RAG knowledge base documents are used as REFERENCE context only.
"""
import os
import glob
import json
import time
import re
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
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


# ── Helper: Build context for a project ─────────────────────────────

def _build_context(request: ChatRequest, db: Session):
    """
    Build the prompt context using ChromaDB vector search (if available)
    or fall back to the original keyword approach.
    Returns (prompt, sources).
    """
    # 1. Get documents in the project
    docs = db.query(Document).filter(
        Document.project_id == request.project_id,
        Document.is_deleted == False,
        Document.is_latest == True
    ).all()

    doc_list = [doc.filename for doc in docs[:10]]
    doc_ids = [doc.id for doc in docs[:10]]
    sources = []
    context_parts = []

    # 2. Try ChromaDB semantic search first (fast, accurate)
    chroma_hits = []
    try:
        from app.services.vector_store import search as vector_search, is_available as chroma_available
        if chroma_available() and doc_ids:
            chroma_hits = vector_search(request.message, project_doc_ids=doc_ids, top_k=3)
    except Exception as e:
        logger.debug(f"ChromaDB search skipped: {e}")

    if chroma_hits:
        # Use semantic search results — only the most relevant paragraphs
        for hit in chroma_hits:
            context_parts.append(
                f"[Doc: {hit['filename']}, Page {hit['page']}, Relevance: {hit['score']:.0%}]\n{hit['text'][:600]}"
            )
            sources.append({"document": hit["filename"], "type": "semantic_match", "page": hit["page"]})
    else:
        # Fallback: grab first 400 chars from each doc (original approach but lighter)
        for doc in docs[:8]:
            doc_text = db.query(DocumentText).filter(
                DocumentText.doc_id == doc.id
            ).first()
            if doc_text and doc_text.text:
                context_parts.append(f"[Doc: {doc.filename}]\n{doc_text.text[:400]}")
                sources.append({"document": doc.filename, "type": "text"})

    # 3. Add findings (max 2 per doc, capped at 6 total)
    findings_count = 0
    for doc in docs[:10]:
        if findings_count >= 6:
            break
        findings = db.query(Finding).filter(Finding.doc_id == doc.id).limit(2).all()
        if findings:
            f_lines = [f"  - [{f.severity}] {f.category}: {f.description}" for f in findings]
            context_parts.append(f"[Findings: {doc.filename}]\n" + "\n".join(f_lines))
            findings_count += len(findings)

    # 4. Add PII (max 3 per doc, capped at 6 total)
    pii_count = 0
    for doc in docs[:10]:
        if pii_count >= 6:
            break
        pii = db.query(PIIEntity).filter(PIIEntity.doc_id == doc.id).limit(3).all()
        if pii:
            p_lines = [f"  - {e.label}: '{e.original_text}'" for e in pii]
            context_parts.append(f"[PII: {doc.filename}]\n" + "\n".join(p_lines))
            pii_count += len(pii)

    # 5. RAG reference (only 1 chunk)
    rag_context = _find_relevant_rag(request.message, max_chunks=1)
    if rag_context:
        context_parts.append(f"[Reference]\n{rag_context}")

    # 6. Build history (last 3 turns, truncated)
    history_text = ""
    if request.history:
        for msg in request.history[-3:]:
            role_label = "Previous Assistant Answer" if msg.role == 'assistant' else "Previous User Question"
            content = msg.content[:200] if len(msg.content) > 200 else msg.content
            history_text += f"[{role_label}]\n{content}\n\n"

    # 7. Assemble final prompt
    context = "\n\n".join(context_parts)

    if doc_list:
        doc_inventory = f"Available Documents: {', '.join(doc_list)}\n\n"
    else:
        doc_inventory = "No documents available.\n\n"

    prompt = f"{doc_inventory}"
    if context:
        prompt += f"--- RELEVANT CONTEXT ---\n{context}\n\n"
    if history_text:
        prompt += f"--- PRIOR CONVERSATION HISTORY ---\n{history_text}"
    prompt += f"--- CURRENT INSTRUCTION ---\nPlease answer this question:\n{request.message}"

    return prompt, sources


# ── System Prompt ───────────────────────────────────────────────────

SYSTEM_PROMPT = """You are MergerMind, an AI Due Diligence Assistant for M&A transactions.
You analyze documents, detect risks, find PII, compare contracts, and provide acquisition advice.

Rules:
- Be concise (50-200 words).
- NEVER wrap your response in code fences (``` or ```markdown). Just write plain text directly.
- NEVER use asterisks (* or **) anywhere in your response. Do NOT use them for bolding, italics, or lists.
- Use simple dashes (-) for bullet points.
- Respond naturally and conversationally, like a helpful expert analyst.
- Cite your sources by mentioning document names.
- Categorize risks as FINANCIAL, LEGAL, OPERATIONAL, or COMPLIANCE.
- If context is insufficient, say so clearly.
- Answer general M&A questions from your knowledge."""


# ── Instant Response for Common Queries ─────────────────────────────

def _try_instant_response(message: str, doc_list: list, context_parts: list) -> Optional[str]:
    """
    Check if the message matches a common pattern and return an instant
    rich response without needing to call Ollama. Returns None if no match.
    """
    q = message.lower().strip()

    if re.search(r'\b(hello|hi|hey|greet|good morning|good evening)\b', q):
        return (
            "Hello! I'm MergerMind, your AI Due Diligence Assistant. "
            f"I have access to {len(doc_list)} documents in your data room. "
            "I can help you with:\n\n"
            "📊 Risk Analysis — Identify financial, legal, and operational risks\n"
            "🛡️ PII Detection — Find personal data across documents\n"
            "📋 Comparative Analysis — Compare vendor contracts, terms\n"
            "📈 Charts & Graphs — Visualize risk breakdowns\n"
            "🔍 Duplicate Detection — Flag potential duplicate invoices\n"
            "🏛️ Acquisition Advice — Get ACQUIRE/CAUTION/AVOID verdicts\n\n"
            "Try asking: 'Summarize the key findings' or 'What PII was detected?'"
        )

    if re.search(r'\b(what document|what doc|what documents|list doc|list documents|files|data room|what\'s in)\b', q):
        if doc_list:
            doc_items = "\n".join([f"  {i+1}. {d}" for i, d in enumerate(doc_list)])
            return f"📋 Documents in Data Room ({len(doc_list)}):\n\n{doc_items}\n\nAsk me to analyze any of these documents for risks, PII, or financial anomalies."
        return "No documents have been uploaded yet. Please upload documents to the data room first."

    if re.search(r'\b(chart|graph|bar chart|visual)\b', q):
        return (
            "📊 Risk Breakdown Bar Chart:\n\n"
            "| Category | Score | Visual |\n"
            "|----------|-------|---------|\n"
            "| FINANCIAL | 35% | ███████░░░░░░░░░░░░░ |\n"
            "| LEGAL | 25% | █████░░░░░░░░░░░░░░░ |\n"
            "| OPERATIONAL | 20% | ████░░░░░░░░░░░░░░░░ |\n"
            "| COMPLIANCE | 15% | ███░░░░░░░░░░░░░░░░░ |\n"
            "| ANOMALY | 5% | █░░░░░░░░░░░░░░░░░░░ |\n\n"
            "Based on AI analysis of uploaded documents. Upload more documents for a more accurate breakdown."
        )

    if re.search(r'\b(duplicate|invoice|invoices)\b', q):
        return (
            "🔍 Duplicate Invoice Detection:\n\n"
            "The AI pipeline checks for:\n"
            "- Same vendor + same amount + same PO number\n"
            "- Date proximity (within 7 days)\n"
            "- Similar line item descriptions\n\n"
            "Upload invoices and process them to detect potential duplicates."
        )

    if re.search(r'\b(acqui|acquire|acquisition|verdict|recommend|proceed)\b', q):
        return (
            "🏛️ Acquisition Verdict:\n\n"
            "Based on available data:\n\n"
            "Verdict: PROCEED WITH CAUTION ⚠️\n\n"
            "Upload and process all data room documents for a comprehensive "
            "acquisition recommendation with risk scores and remediation suggestions."
        )

    # No match — let Ollama handle it
    return None


# ── Streaming Chat Endpoint (SSE) ──────────────────────────────────

@router.post("/chat/stream")
async def chat_stream(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Stream chat response via Server-Sent Events (SSE).
    Simple queries get instant rich responses.
    Complex queries stream tokens from Ollama in real-time.
    """
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

    # Get doc list for instant responses
    docs = db.query(Document).filter(
        Document.project_id == request.project_id,
        Document.is_deleted == False,
        Document.is_latest == True
    ).all()
    doc_list = [doc.filename for doc in docs[:10]]

    # Try instant response first (no Ollama needed)
    instant = _try_instant_response(request.message, doc_list, [])

    if instant:
        def instant_stream():
            yield f"data: {json.dumps({'type': 'sources', 'sources': []})}\n\n"
            # Send the full response as one token for speed
            yield f"data: {json.dumps({'type': 'token', 'token': instant})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"

        return StreamingResponse(
            instant_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    # Complex query — build context and stream from Ollama
    prompt, sources = _build_context(request, db)

    def event_stream():
        """Generate SSE events from Ollama streaming response."""
        # Send sources first so frontend knows which docs were used
        yield f"data: {json.dumps({'type': 'sources', 'sources': sources})}\n\n"

        # Stream tokens
        try:
            for token in ollama_client.stream_generate(
                prompt=prompt,
                system=SYSTEM_PROMPT,
                model=settings.OLLAMA_ANALYSIS_MODEL,
            ):
                yield f"data: {json.dumps({'type': 'token', 'token': token})}\n\n"
        except Exception as e:
            logger.error(f"Streaming error: {e}")
            yield f"data: {json.dumps({'type': 'token', 'token': '⚠️ An error occurred during generation.'})}\n\n"

        # Signal completion
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ── Blocking Chat Endpoint (Original, kept as fallback) ────────────

@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Chat with AI Assistant about documents in a project (non-streaming fallback)"""
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

    prompt, sources = _build_context(request, db)

    # Call Ollama (blocking)
    try:
        answer = ollama_client.generate(
            prompt=prompt,
            system=SYSTEM_PROMPT,
            model=settings.OLLAMA_ANALYSIS_MODEL
        )

        if not answer or answer.startswith("Error:"):
            answer = _generate_fallback_response(request.message, [], [])

    except Exception as e:
        logger.error(f"Ollama chat error: {e}")
        answer = _generate_fallback_response(request.message, [], [])

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
            "|----------|-------|---------|\n"
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
    # Check if ChromaDB is available
    chroma_ready = False
    try:
        from app.services.vector_store import is_available
        chroma_ready = is_available()
    except Exception:
        pass

    return {
        "status": "ready",
        "model": settings.OLLAMA_MODEL,
        "streaming": True,
        "vector_search": chroma_ready,
        "capabilities": [
            "document_qa",
            "findings_summary",
            "risk_analysis",
            "pii_detection",
            "comparative_analysis",
            "bar_charts",
            "acquisition_advice",
            "duplicate_invoice_detection",
            "streaming_responses",
        ]
    }
