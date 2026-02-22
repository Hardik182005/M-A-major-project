"""
Ollama client for SLM (classification, PII detection) and LLM (analysis, findings generation).
"""
import json
import logging
from typing import Optional, Dict, Any, List
import requests
from app.config import settings

logger = logging.getLogger(__name__)


class OllamaClient:
    """Client for interacting with Ollama API."""
    
    def __init__(
        self,
        base_url: str = None,
        timeout: int = None,
    ):
        self.base_url = base_url or settings.OLLAMA_BASE_URL
        self.timeout = timeout or settings.OLLAMA_TIMEOUT
        self.session = requests.Session()
    
    def _call_api(self, model: str, prompt: str, system: str = None, format_json: bool = False) -> Dict[str, Any]:
        """Make a request to the Ollama API."""
        endpoint = "/api/chat"
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "stream": False,
        }
        if system:
            payload["messages"].insert(0, {"role": "system", "content": system})
        if format_json:
            payload["format"] = "json"
        
        try:
            response = self.session.post(
                f"{self.base_url}{endpoint}",
                json=payload,
                timeout=self.timeout,
            )
            response.raise_for_status()
            result = response.json()
            
            # Parse the response
            if endpoint == "/api/chat":
                text = result.get("message", {}).get("content", "").strip()
            else:
                text = result.get("response", "").strip()
            
            if format_json:
                try:
                    return json.loads(text)
                except json.JSONDecodeError:
                    logger.warning(f"Failed to parse JSON from Ollama response: {text}")
                    return {"error": "parse_failed", "raw": text}
            
            return {"text": text}
            
        except requests.exceptions.Timeout:
            logger.error(f"Ollama request timed out after {self.timeout}s")
            return {"error": "timeout"}
        except requests.exceptions.RequestException as e:
            logger.error(f"Ollama request failed: {e}")
            return {"error": str(e)}
    
    def classify_document(self, text: str) -> Dict[str, Any]:
        """
        Classify a document using Ollama.
        
        Returns:
            dict with doc_type, confidence, tags, needs_vlm, sensitivity
        """
        model = settings.OLLAMA_CLASSIFICATION_MODEL
        
        system_prompt = """You are a document classification expert. Analyze the document and classify it.
Return ONLY valid JSON with these exact fields:
{
    "doc_type": "contract|invoice|financial_statement|policy|report|email|unknown",
    "confidence": 0.0-1.0,
    "tags": ["tag1", "tag2"],
    "needs_vlm": true|false,
    "sensitivity": "LOW|MEDIUM|HIGH"
}

Consider:
- contracts need legal review, high sensitivity
- invoices contain financial data, medium-high sensitivity
- financial statements are highly sensitive
- policies are medium sensitivity
- Reports may contain confidential info
- needs_vlm = true if document has tables, forms, or scanned images that need visual understanding"""

        prompt = f"""Classify this document. Provide a brief analysis then the JSON.

Document preview (first 8000 characters):
{text[:8000]}

Classification:"""

        result = self._call_api(model, prompt, system=system_prompt, format_json=True)
        
        if "error" in result:
            logger.error(f"Document classification failed: {result}")
            return {
                "doc_type": "unknown",
                "confidence": 0.0,
                "tags": [],
                "needs_vlm": False,
                "sensitivity": "LOW",
                "raw_output": result,
            }
        
        return {
            "doc_type": result.get("doc_type", "unknown"),
            "confidence": float(result.get("confidence", 0.0)),
            "tags": result.get("tags", []),
            "needs_vlm": bool(result.get("needs_vlm", False)),
            "sensitivity": result.get("sensitivity", "LOW"),
            "raw_output": result,
        }
    
    def detect_pii(self, text: str, page: int = None) -> Dict[str, Any]:
        """
        Detect PII entities using Ollama semantic analysis.
        
        Returns:
            dict with entities list containing label, text, confidence, page
        """
        model = settings.OLLAMA_PII_MODEL
        
        system_prompt = """You are a PII detection expert. Identify personally identifiable information (PII) in the text.
Return ONLY valid JSON with this exact structure:
{
    "entities": [
        {"label": "PERSON", "text": "John Doe", "confidence": 0.85},
        {"label": "EMAIL", "text": "john@example.com", "confidence": 0.95},
        {"label": "PHONE", "text": "+1-555-123-4567", "confidence": 0.90},
        {"label": "SSN", "text": "123-45-6789", "confidence": 0.98},
        {"label": "ADDRESS", "text": "123 Main St, City", "confidence": 0.75},
        {"label": "ORGANIZATION", "text": "Acme Corp", "confidence": 0.80},
        {"label": "DATE", "text": "January 15, 2024", "confidence": 0.70},
        {"label": "ACCOUNT", "text": "Account #12345", "confidence": 0.85}
    ]
}

Focus on:
- Names of people (PERSON)
- Email addresses (EMAIL)
- Phone numbers (PHONE)
- Social Security Numbers (SSN)
- Physical addresses (ADDRESS)
- Company names (ORGANIZATION)
- Bank account numbers (ACCOUNT)
- Employee IDs or client IDs

Only return entities you are confident about (confidence > 0.6)."""

        prompt = f"""Detect PII entities in this text:

{text[:6000]}

PII Detection:"""

        result = self._call_api(model, prompt, system=system_prompt, format_json=True)
        
        entities = []
        if "error" not in result and "entities" in result:
            for entity in result["entities"]:
                entities.append({
                    "label": entity.get("label", "UNKNOWN"),
                    "original_text": entity.get("text", ""),
                    "confidence": float(entity.get("confidence", 0.0)),
                    "page": page,
                })
        
        return {"entities": entities}
    
    def generate_findings(
        self,
        text: str,
        doc_type: str,
        structured_data: Dict[str, Any] = None,
    ) -> Dict[str, Any]:
        """
        Generate AI findings from document analysis.
        
        Returns:
            dict with findings list and risk_score_delta
        """
        model = settings.OLLAMA_ANALYSIS_MODEL
        
        system_prompt = f"""You are a senior M&A Due Diligence Analyst evaluating a {doc_type} document for potential acquisition risks.
Analyze the document with high scrutiny and identify core findings, massive liabilities, intellectual property issues, compliance gaps, anomalies, and structural risks.

Return ONLY valid JSON with this exact structure:
{{
    "findings": [
        {{
            "category": "LEGAL|FINANCIAL|COMPLIANCE|RISK|ANOMALY|ADVICE|TREND|IP_ISSUE",
            "type": "MISSING_CLAUSE|CHANGE_OF_CONTROL|LITIGATION_RISK|UNUSUAL_PATTERN|STRATEGIC_ADVICE|TREND_ANALYSIS|PENALTY",
            "severity": "LOW|MEDIUM|HIGH|CRITICAL",
            "description": "Clear description of the finding, trend, or advice. Explain WHY it matters to the acquisition.",
            "evidence_page": 1,
            "evidence_quote": "Exact quote from document highlighting this risk",
            "confidence": 0.85
        }}
    ],
    "risk_score_delta": 15
}}

Strict Rules:
- If a finding is "CRITICAL", it must be a dealbreaker or major liability.
- Only include findings with a confidence > 0.6.
- Keep the analysis extremely sharp and identifying specific risks for {doc_type}. 
- If no risks found, return empty findings list."""

        context_parts = [f"Document type: {doc_type}\n\nDocument content:\n{text[:10000]}"]
        
        if structured_data:
            context_parts.append(f"\n\nExtracted structured data:\n{json.dumps(structured_data, indent=2)}")
        
        prompt = "\n".join(context_parts) + "\n\nAnalysis:"
        
        result = self._call_api(model, prompt, system=system_prompt, format_json=True)
        
        if "error" in result:
            logger.error(f"Findings generation failed: {result}")
            return {
                "findings": [],
                "risk_score_delta": 0,
                "raw_output": result,
            }
        
        return {
            "findings": result.get("findings", []),
            "risk_score_delta": int(result.get("risk_score_delta", 0)),
            "raw_output": result,
        }
    
    def answer_question(
        self,
        question: str,
        context_chunks: List[str],
        structured_data: Dict[str, Any] = None,
    ) -> Dict[str, Any]:
        """
        Answer a question using RAG context.
        
        Returns:
            dict with answer and sources
        """
        model = settings.OLLAMA_ANALYSIS_MODEL
        
        system_prompt = """You are a helpful AI assistant for a document analysis system.
        Answer questions based ONLY on the provided context.
        If you cannot find the answer in the context, say so clearly.
        Cite your sources by mentioning which document/chunk you used."""

        context = "\n\n---\n\n".join(context_chunks)
        
        if structured_data:
            context += f"\n\nStructured Data:\n{json.dumps(structured_data, indent=2)}"
        
        prompt = f"""Context:
{context}

Question: {question}

Answer:"""

        result = self._call_api(model, prompt, system=system_prompt)
        
        if "error" in result:
            return {
                "answer": "I encountered an error processing your question.",
                "sources": [],
                "error": result.get("error"),
            }
        
        return {
            "answer": result.get("text", ""),
            "sources": context_chunks[:3],  # Top 3 source chunks
        }
    
    def generate(self, prompt: str, model: str = None, max_tokens: int = 500) -> str:
        """
        Simple generate method for basic text generation.
        
        Args:
            prompt: The prompt to send to the model
            model: Model to use (defaults to OLLAMA_ANALYSIS_MODEL)
            max_tokens: Maximum tokens to generate (not used in Ollama, but kept for API compatibility)
            
        Returns:
            Generated text string
        """
        if model is None:
            model = settings.OLLAMA_ANALYSIS_MODEL
        
        result = self._call_api(model, prompt)
        
        if "error" in result:
            logger.error(f"Generate failed: {result}")
            return f"Error: {result.get('error', 'Unknown error')}"
        
        return result.get("text", "")


# Singleton instance
ollama_client = OllamaClient()
