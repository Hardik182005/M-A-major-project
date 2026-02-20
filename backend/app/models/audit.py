from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db import Base


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(50), nullable=False, index=True)
    # Actions: REGISTER | LOGIN | CREATE_PROJECT | ADD_MEMBER | REMOVE_MEMBER
    #          UPLOAD_DOCUMENT | DOWNLOAD_DOCUMENT | DELETE_DOCUMENT | RESTORE_DOCUMENT
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    ip_address = Column(String(45), nullable=True)  # IPv4/IPv6
    meta_json = Column(Text, nullable=True)  # JSON string for extra metadata

    # relationships
    project = relationship("Project", back_populates="audit_events")
    document = relationship("Document", backref="audit_events")
    actor = relationship("User", backref="audit_actions")
