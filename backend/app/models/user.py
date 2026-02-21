from sqlalchemy import Column, Integer, String, DateTime, Boolean
from datetime import datetime
from app.db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    is_active = Column(Boolean, default=True, server_default="true")
    created_at = Column(DateTime, default=datetime.utcnow)

    # account lockout
    failed_login_attempts = Column(Integer, default=0, server_default="0")
    locked_until = Column(DateTime, nullable=True)

    # password reset
    reset_token = Column(String, nullable=True, index=True)
    reset_token_expiry = Column(DateTime, nullable=True)
