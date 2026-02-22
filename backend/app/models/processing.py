from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Float, Boolean, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db import Base


class ProcessingJob(Base):
    """
    Tracks document processing pipeline jobs with stage-by-stage progress.
    """
    __tablename__ = "processing_jobs"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    doc_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    batch_id = Column(String(64), nullable=True, index=True)  # For batch processing
    
    # Processing stage and progress
    stage = Column(String(50), default="QUEUED")  # QUEUED, UPLOADED, TEXT_EXTRACTION, CLASSIFICATION, PII_SCANNING, STRUCTURING, ANALYSIS, INDEXING, COMPLETED, FAILED
    progress = Column(Integer, default=0)  # 0-100
    status = Column(String(30), default="QUEUED")  # QUEUED, PROCESSING, COMPLETED, FAILED, CANCELLED
    
    # Timing
    eta_seconds = Column(Integer, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Error tracking
    error_code = Column(String(50), nullable=True)
    error_msg = Column(Text, nullable=True)
    
    # Retry tracking
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    
    # Metadata
    worker_id = Column(String(100), nullable=True)
    
    # Relationships
    document = relationship("Document", back_populates="processing_jobs")


class DocumentText(Base):
    """
    Stores extracted text from documents.
    """
    __tablename__ = "document_text"

    id = Column(Integer, primary_key=True, index=True)
    doc_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, unique=True)
    
    # Full extracted text
    text = Column(Text, nullable=True)
    
    # Per-page text (JSON array)
    pages_json = Column(JSON, nullable=True)
    
    # Metadata
    page_count = Column(Integer, nullable=True)
    char_count = Column(Integer, nullable=True)
    extraction_method = Column(String(50), nullable=True)  # pypdf, pdfminer, tesseract, vlm
    extraction_quality = Column(Float, nullable=True)  # 0-1 quality score
    needs_vlm = Column(Boolean, default=False)  # True if quality is low and VLM is needed
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    document = relationship("Document", back_populates="text_record")


class PIIEntity(Base):
    """
    Stores PII entities detected in documents.
    """
    __tablename__ = "pii_entities"

    id = Column(Integer, primary_key=True, index=True)
    doc_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    
    # Entity location
    page = Column(Integer, nullable=True)
    start = Column(Integer, nullable=True)  # Character position
    end = Column(Integer, nullable=True)
    
    # Entity details
    label = Column(String(50), nullable=False)  # PERSON, ORGANIZATION, SSN, EMAIL, PHONE, ADDRESS, etc.
    original_text = Column(Text, nullable=True)
    replacement = Column(String(100), nullable=True)  # e.g., PERSON_1, ORG_1
    
    # Confidence
    confidence = Column(Float, nullable=True)
    detection_method = Column(String(50), nullable=True)  # rule-based, semantic
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    document = relationship("Document", back_populates="pii_entities")


class DocumentClassification(Base):
    """
    Stores document classification results.
    """
    __tablename__ = "doc_classification"

    id = Column(Integer, primary_key=True, index=True)
    doc_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, unique=True)
    
    # Classification results
    doc_type = Column(String(100), nullable=True)  # contract, invoice, financial_statement, policy, report, unknown
    sensitivity = Column(String(20), nullable=True)  # LOW, MEDIUM, HIGH
    confidence = Column(Float, nullable=True)
    tags = Column(JSON, nullable=True)  # Array of tags
    
    # Additional flags
    needs_vlm = Column(Boolean, default=False)
    
    # Raw model output for debugging
    raw_output = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    document = relationship("Document", back_populates="classification")


class DocumentStructured(Base):
    """
    Stores structured data extracted from documents (via Donut VLM).
    """
    __tablename__ = "doc_structured"

    id = Column(Integer, primary_key=True, index=True)
    doc_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    
    # Schema type
    schema_type = Column(String(50), nullable=True)  # invoice, financial_statement, contract, form
    
    # Extracted data
    json_blob = Column(JSON, nullable=True)
    
    # Confidence
    confidence = Column(Float, nullable=True)
    
    # Page where data was found
    source_page = Column(Integer, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    document = relationship("Document", back_populates="structured_data")


class Finding(Base):
    """
    Stores AI-generated findings from document analysis.
    """
    __tablename__ = "findings"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    doc_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    
    # Finding details
    category = Column(String(50), nullable=False)  # LEGAL, FINANCIAL, COMPLIANCE, RISK, ANOMALY
    type = Column(String(100), nullable=True)  # MISSING_CLAUSE, DUPLICATE_INVOICE, etc.
    severity = Column(String(20), nullable=False)  # LOW, MEDIUM, HIGH, CRITICAL
    status = Column(String(30), default="NEW")  # NEW, CONFIRMED, DISMISSED, RESOLVED
    
    description = Column(Text, nullable=False)
    
    # Evidence
    evidence_page = Column(Integer, nullable=True)
    evidence_quote = Column(Text, nullable=True)
    evidence_span_start = Column(Integer, nullable=True)
    evidence_span_end = Column(Integer, nullable=True)
    
    # Confidence
    confidence = Column(Float, nullable=True)
    
    # Metadata
    tags = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    document = relationship("Document", back_populates="findings")
    project = relationship("Project", back_populates="findings")


class DocumentChunk(Base):
    """
    Stores text chunks for RAG-based AI Assistant.
    """
    __tablename__ = "document_chunks"

    id = Column(Integer, primary_key=True, index=True)
    doc_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    
    # Chunk content
    chunk_text = Column(Text, nullable=False)
    chunk_index = Column(Integer, nullable=False)
    
    # Location
    page = Column(Integer, nullable=True)
    section = Column(String(100), nullable=True)
    
    # Embedding (stored as array for pgvector compatibility)
    embedding = Column(JSON, nullable=True)
    
    # Metadata
    char_count = Column(Integer, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    document = relationship("Document", back_populates="chunks")
