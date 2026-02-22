"""
Processing pipeline worker - orchestrates the AI pipeline stages.
"""
import logging
import os
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.config import settings
from app.models.processing import (
    ProcessingJob,
    DocumentText,
    PIIEntity,
    DocumentClassification,
    DocumentStructured,
    Finding,
)
from app.models.document import Document
from app.services.text_extraction import text_extractor
from app.services.ollama_client import ollama_client
from app.services.pii_detection import pii_detector
from app.services.donut_client import donut_client

logger = logging.getLogger(__name__)


class PipelineWorker:
    """Worker that processes documents through the AI pipeline."""
    
    STORAGE_DIR = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
        settings.STORAGE_DIR
    )
    
    def __init__(self):
        self.db: Optional[Session] = None
    
    def process_document(self, job_id: int) -> bool:
        """
        Process a document through all pipeline stages.
        
        Args:
            job_id: The ProcessingJob ID
        
        Returns:
            True if successful, False otherwise
        """
        self.db = SessionLocal()
        
        try:
            # Get job
            job = self.db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
            if not job:
                logger.error(f"Job {job_id} not found")
                return False
            
            # Get document
            doc = self.db.query(Document).filter(Document.id == job.doc_id).first()
            if not doc:
                self._fail_job(job, "Document not found")
                return False
            
            # Get file path
            file_path = os.path.join(self.STORAGE_DIR, doc.storage_key)
            if not os.path.exists(file_path):
                self._fail_job(job, f"File not found: {file_path}")
                return False
            
            # Start processing
            self._start_job(job)
            
            # Stage 1: Text Extraction
            if not self._stage_text_extraction(job, doc, file_path):
                return False
            
            # Stage 2: Classification (SLM)
            if not self._stage_classification(job, doc):
                return False
            
            # Stage 3: PII Detection
            if not self._stage_pii_detection(job, doc):
                return False
            
            # Stage 4: Structure Extraction (VLM) - if needed
            if not self._stage_structure_extraction(job, doc):
                pass  # Continue even if VLM fails - it's optional
            
            # Stage 5: Analysis (LLM) - Generate Findings
            if not self._stage_analysis(job, doc):
                return False  # Do not continue if analysis fails
                
            # Stage 6: Indexing for RAG
            if not self._stage_indexing(job, doc):
                logger.warning(f"Indexing failed for job {job_id}, continuing...")
            
            # Complete job
            self._complete_job(job)
            
            # Log audit event
            from app.services.audit import log_audit
            log_audit(
                self.db, 
                "AI_ANALYSIS_COMPLETE", 
                actor_id=doc.uploaded_by,  # Attributing to the uploader as the trigger
                project_id=doc.project_id,
                document_id=doc.id,
                filename=doc.filename
            )
            self.db.commit()
            
            return True
            
        except Exception as e:
            logger.error(f"Pipeline processing failed: {e}", exc_info=True)
            self._fail_job(job, str(e))
            return False
        
        finally:
            if self.db:
                self.db.close()
    
    def _start_job(self, job: ProcessingJob):
        """Mark job as started."""
        job.status = "PROCESSING"
        job.stage = "UPLOADED"
        job.progress = 5
        job.started_at = datetime.utcnow()
        self.db.commit()
        logger.info(f"Job {job.id} started")
    
    def _complete_job(self, job: ProcessingJob):
        """Mark job as completed."""
        job.status = "COMPLETED"
        job.stage = "COMPLETED"
        job.progress = 100
        job.completed_at = datetime.utcnow()
        self.db.commit()
        logger.info(f"Job {job.id} completed successfully")
    
    def _fail_job(self, job: ProcessingJob, error_msg: str, error_code: str = "PROCESSING_ERROR"):
        """Mark job as failed."""
        if job:
            job.status = "FAILED"
            job.error_code = error_code
            job.error_msg = error_msg
            job.completed_at = datetime.utcnow()
            self.db.commit()
        logger.error(f"Job {job.id} failed: {error_msg}")
    
    # ── Stage 1: Text Extraction ─────────────────────────────────────────
    
    def _stage_text_extraction(self, job: ProcessingJob, doc: Document, file_path: str) -> bool:
        """Extract text from document."""
        job.stage = "TEXT_EXTRACTION"
        job.progress = 10
        self.db.commit()
        
        try:
            logger.info(f"Extracting text from document {doc.id}")
            
            # Extract text
            result = text_extractor.extract(file_path, doc.file_type)
            
            if result.get("error"):
                logger.warning(f"Text extraction error: {result['error']}")
            
            # Save to DB
            text_record = self.db.query(DocumentText).filter(
                DocumentText.doc_id == doc.id
            ).first()
            
            if not text_record:
                text_record = DocumentText(doc_id=doc.id)
                self.db.add(text_record)
            
            text_record.text = result.get("text", "")
            text_record.pages_json = result.get("pages_json")
            text_record.page_count = result.get("page_count", 0)
            text_record.char_count = result.get("char_count", 0)
            text_record.extraction_method = result.get("extraction_method")
            text_record.extraction_quality = result.get("quality", 0.0)
            text_record.needs_vlm = result.get("needs_vlm", False)
            
            # Update document page count
            doc.page_count = text_record.page_count
            
            self.db.commit()
            
            # Store for later stages
            job.doc_id = doc.id  # Ensure job is linked
            
            logger.info(f"Text extraction complete: {text_record.char_count} chars, quality: {text_record.extraction_quality:.2f}")
            return True
            
        except Exception as e:
            self._fail_job(job, f"Text extraction failed: {e}")
            return False
    
    # ── Stage 2: Classification (SLM) ────────────────────────────────────
    
    def _stage_classification(self, job: ProcessingJob, doc: Document) -> bool:
        """Classify document using Ollama SLM."""
        job.stage = "CLASSIFICATION"
        job.progress = 30
        self.db.commit()
        
        try:
            # Get extracted text
            text_record = self.db.query(DocumentText).filter(
                DocumentText.doc_id == doc.id
            ).first()
            
            if not text_record or not text_record.text:
                logger.warning("No text available for classification")
                job.progress = 35
                self.db.commit()
                return True  # Skip classification if no text
            
            # Truncate text for classification
            text = text_record.text[:settings.MAX_TEXT_LENGTH_FOR_CLASSIFICATION]
            
            logger.info(f"Classifying document {doc.id} with Ollama")
            
            # Call Ollama for classification
            result = ollama_client.classify_document(text)
            
            # Save classification
            classification = self.db.query(DocumentClassification).filter(
                DocumentClassification.doc_id == doc.id
            ).first()
            
            if not classification:
                classification = DocumentClassification(doc_id=doc.id)
                self.db.add(classification)
            
            classification.doc_type = result.get("doc_type", "unknown")
            classification.sensitivity = result.get("sensitivity", "LOW")
            classification.confidence = result.get("confidence", 0.0)
            classification.tags = result.get("tags", [])
            classification.needs_vlm = result.get("needs_vlm", False)
            classification.raw_output = result.get("raw_output")
            
            # Override needs_vlm if text quality was low
            if text_record.needs_vlm:
                classification.needs_vlm = True
            
            self.db.commit()
            
            logger.info(f"Classification complete: {classification.doc_type}, sensitivity: {classification.sensitivity}")
            return True
            
        except Exception as e:
            logger.error(f"Classification failed: {e}")
            job.progress = 35
            self.db.commit()
            return True  # Continue even if classification fails
    
    # ── Stage 3: PII Detection ────────────────────────────────────────────
    
    def _stage_pii_detection(self, job: ProcessingJob, doc: Document) -> bool:
        """Detect and pseudonymize PII."""
        job.stage = "PII_SCANNING"
        job.progress = 50
        self.db.commit()
        
        try:
            # Get text
            text_record = self.db.query(DocumentText).filter(
                DocumentText.doc_id == doc.id
            ).first()
            
            if not text_record or not text_record.text:
                logger.warning("No text available for PII detection")
                return True
            
            # Reset PII detector counters for this document
            pii_detector.reset_counters()
            
            # Run rule-based detection
            rule_entities = pii_detector.detect(text_record.text)
            
            # Run semantic detection with Ollama (on first few pages)
            semantic_entities = []
            if text_record.pages_json:
                first_pages_text = "\n\n".join(text_record.pages_json[:3])
                try:
                    semantic_result = ollama_client.detect_pii(first_pages_text)
                    semantic_entities = semantic_result.get("entities", [])
                except Exception as e:
                    logger.warning(f"Ollama PII detection failed: {e}")
            
            # Combine entities (semantic takes precedence for same positions)
            all_entities = rule_entities + [
                {**e, "detection_method": "semantic"}
                for e in semantic_entities
                if e.get("confidence", 0) > 0.6
            ]
            
            # Save entities
            # First, delete old entities
            self.db.query(PIIEntity).filter(PIIEntity.doc_id == doc.id).delete()
            
            # Add new entities
            for entity in all_entities:
                pii_entity = PIIEntity(
                    doc_id=doc.id,
                    label=entity.get("label", "UNKNOWN"),
                    original_text=entity.get("text") or entity.get("original_text", ""),
                    page=entity.get("page"),
                    start=entity.get("start", 0),
                    end=entity.get("end", 0),
                    confidence=entity.get("confidence", 0.0),
                    detection_method=entity.get("detection_method", "rule-based"),                )
                self.db.add(pii_entity)
            
            # Pseudonymize text for safe LLM processing
            pseudonymized_text, replacements = pii_detector.pseudonymize(
                text_record.text, all_entities
            )
            
            # Store pseudonymized version
            text_record.text = pseudonymized_text
            
            self.db.commit()
            
            logger.info(f"PII detection complete: {len(all_entities)} entities found")
            return True
            
        except Exception as e:
            logger.error(f"PII detection failed: {e}")
            return True  # Continue even if PII detection fails
    
    # ── Stage 4: Structure Extraction (VLM) ──────────────────────────────
    
    def _stage_structure_extraction(self, job: ProcessingJob, doc: Document) -> bool:
        """Extract structured data using Donut VLM."""
        job.stage = "STRUCTURING"
        job.progress = 65
        self.db.commit()
        
        try:
            # Get classification to determine schema
            classification = self.db.query(DocumentClassification).filter(
                DocumentClassification.doc_id == doc.id
            ).first()
            
            # Get text record
            text_record = self.db.query(DocumentText).filter(
                DocumentText.doc_id == doc.id
            ).first()

            # Check if VLM is needed
            needs_vlm = (
                classification and classification.needs_vlm
            ) or (
                text_record and text_record.needs_vlm
            )
            
            if not needs_vlm:
                logger.info(f"VLM not needed for document {doc.id}")
                return True
            
            if not donut_client.is_available():
                logger.warning("Donut VLM not available, skipping structure extraction")
                return True
            
            # Get file path
            file_path = os.path.join(self.STORAGE_DIR, doc.storage_key)
            
            # Determine schema type
            schema_type = "invoice"
            if classification:
                if classification.doc_type == "invoice":
                    schema_type = "invoice"
                elif classification.doc_type == "financial_statement":
                    schema_type = "financial_statement"
                elif classification.doc_type == "contract":
                    schema_type = "contract"
            
            logger.info(f"Running Donut VLM on document {doc.id} with schema {schema_type}")
            
            # Run Donut
            result = donut_client.extract_structure(file_path, schema_type)
            
            if result.get("data"):
                structured = DocumentStructured(
                    doc_id=doc.id,
                    schema_type=result.get("schema_type"),
                    json_blob=result.get("data"),
                    confidence=result.get("confidence", 0.0),
                )
                self.db.add(structured)
                self.db.commit()
                
                logger.info(f"Structure extraction complete: {schema_type}")
            
            return True
            
        except Exception as e:
            logger.error(f"Structure extraction failed: {e}")
            return True  # Continue even if VLM fails
    
    # ── Stage 5: Analysis (LLM) ───────────────────────────────────────────
    
    def _stage_analysis(self, job: ProcessingJob, doc: Document) -> bool:
        """Generate findings using Ollama LLM."""
        job.stage = "ANALYSIS"
        job.progress = 80
        self.db.commit()
        
        try:
            # Get text and classification
            text_record = self.db.query(DocumentText).filter(
                DocumentText.doc_id == doc.id
            ).first()
            
            classification = self.db.query(DocumentClassification).filter(
                DocumentClassification.doc_id == doc.id
            ).first()
            
            if not text_record or not text_record.text:
                logger.warning("No text available for analysis")
                return True
            
            doc_type = classification.doc_type if classification else "unknown"
            
            # Get structured data if available
            structured_data = None
            structured = self.db.query(DocumentStructured).filter(
                DocumentStructured.doc_id == doc.id
            ).first()
            if structured:
                structured_data = structured.json_blob
            
            logger.info(f"Generating findings for document {doc.id}")
            
            # Call Ollama for analysis
            result = ollama_client.generate_findings(
                text_record.text[:15000],  # Limit text size
                doc_type,
                structured_data,
            )
            
            if "error" in result:
                raise Exception(f"AI Risk Assessment Failed: {result['error']}")
                
            findings_data = result.get("findings", [])
            
            # Save findings
            for finding_data in findings_data:
                # Sanitize from small LLM hallucinations
                cat = str(finding_data.get("category", "RISK"))[:50].upper()
                typ = str(finding_data.get("type", "UNKNOWN"))[:100]
                sev = str(finding_data.get("severity", "MEDIUM"))[:20].upper()
                desc = str(finding_data.get("description", ""))
                
                finding = Finding(
                    project_id=doc.project_id,
                    doc_id=doc.id,
                    category=cat,
                    type=typ,
                    severity=sev if sev in ["LOW", "MEDIUM", "HIGH", "CRITICAL"] else "MEDIUM",
                    description=desc,
                    evidence_page=finding_data.get("evidence_page"),
                    evidence_quote=str(finding_data.get("evidence_quote", ""))[:1000] if finding_data.get("evidence_quote") else None,
                    confidence=float(finding_data.get("confidence", 0.0)) if isinstance(finding_data.get("confidence"), (int, float)) else 0.5,
                )
                self.db.add(finding)
                
            # Programmatic check for duplicate invoices based on structured data
            if structured_data and doc_type == "invoice":
                invoice_num = structured_data.get("invoice_number")
                if invoice_num:
                    # Find other invoices in this project with same invoice_number
                    other_invoices = self.db.query(DocumentStructured).join(Document).filter(
                        Document.project_id == doc.project_id,
                        Document.id != doc.id,
                        DocumentStructured.schema_type == "invoice"
                    ).all()
                    
                    for other in other_invoices:
                        if other.json_blob and other.json_blob.get("invoice_number") == invoice_num:
                            # It's a duplicate!
                            dup_finding = Finding(
                                project_id=doc.project_id,
                                doc_id=doc.id,
                                category="FINANCIAL",
                                type="DUPLICATE_INVOICE",
                                severity="HIGH",
                                description=f"This invoice has the same invoice number ({invoice_num}) as another document in the data room.",
                                evidence_quote=invoice_num,
                                confidence=0.95
                            )
                            self.db.add(dup_finding)
                            findings_data.append({"type": "DUPLICATE_INVOICE"})
                            break
            
            self.db.commit()
            
            logger.info(f"Analysis complete: {len(findings_data)} findings generated")
            return True
            
        except Exception as e:
            logger.error(f"Analysis failed: {e}")
            self._fail_job(job, str(e))
            return False
    
    # ── Stage 6: Indexing (RAG) ─────────────────────────────────────────
    
    def _stage_indexing(self, job: ProcessingJob, doc: Document) -> bool:
        """Create chunks for RAG-based AI Assistant."""
        job.stage = "INDEXING"
        job.progress = 90
        self.db.commit()
        
        try:
            # Get text
            text_record = self.db.query(DocumentText).filter(
                DocumentText.doc_id == doc.id
            ).first()
            
            if not text_record or not text_record.text:
                logger.warning("No text available for indexing")
                return True
            
            # Simple chunking by paragraphs
            pages = text_record.pages_json or [text_record.text]
            
            from app.models.processing import DocumentChunk
            
            # Clear old chunks
            self.db.query(DocumentChunk).filter(DocumentChunk.doc_id == doc.id).delete()
            
            chunk_index = 0
            for page_num, page_text in enumerate(pages, start=1):
                # Split by paragraphs
                paragraphs = page_text.split("\n\n")
                
                for para in paragraphs:
                    para = para.strip()
                    if len(para) < 50:  # Skip too short chunks
                        continue
                    
                    chunk = DocumentChunk(
                        doc_id=doc.id,
                        chunk_text=para,
                        chunk_index=chunk_index,
                        page=page_num,
                        char_count=len(para),
                    )
                    self.db.add(chunk)
                    chunk_index += 1
            
            self.db.commit()
            
            logger.info(f"Indexing complete: {chunk_index} chunks created")
            return True
            
        except Exception as e:
            logger.error(f"Indexing failed: {e}")
            return False


def process_document_task(job_id: int):
    """
    Standalone function to process a document.
    Ensures that each background task gets its own PipelineWorker instance,
    providing full database session isolation per thread.
    """
    worker = PipelineWorker()
    return worker.process_document(job_id)
