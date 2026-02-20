from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean, BigInteger
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db import Base


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)

    # stable document key — same file re-uploaded keeps same doc_key
    doc_key = Column(String(64), nullable=False, index=True)

    filename = Column(String(500), nullable=False)
    file_type = Column(String(100), nullable=True)   # MIME content type
    file_size = Column(BigInteger, nullable=True)     # bytes
    version = Column(Integer, default=1)
    is_latest = Column(Boolean, default=True)

    # integrity
    checksum = Column(String(64), nullable=True)      # SHA-256

    # storage
    storage_provider = Column(String(20), default="local")  # local | s3 | azure
    storage_key = Column(Text, nullable=False)               # path or object key

    # upload lifecycle: UPLOADING → READY | FAILED
    status = Column(String(30), default="UPLOADING")

    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    # soft delete
    is_deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    # legal hold / lock — prevents delete and overwrite
    is_locked = Column(Boolean, default=False)
    locked_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    locked_at = Column(DateTime, nullable=True)
    lock_reason = Column(String(500), nullable=True)

    # relationships
    project = relationship("Project", back_populates="documents")
    uploader = relationship("User", foreign_keys=[uploaded_by], backref="uploaded_documents")
    deleter = relationship("User", foreign_keys=[deleted_by])
    locker = relationship("User", foreign_keys=[locked_by])
