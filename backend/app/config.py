"""Centralized configuration – reads from .env / environment."""
import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    # ── Database ─────────────────────────────────────────
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5433/dataroom")

    # ── JWT / Auth ───────────────────────────────────────
    SECRET_KEY: str = os.getenv("SECRET_KEY", "supersecret")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

    # ── Rate Limiting ────────────────────────────────────
    LOGIN_RATE_LIMIT_WINDOW: int = 300  # seconds (5 min)
    LOGIN_RATE_LIMIT_MAX: int = 10      # max attempts per window
    ACCOUNT_LOCK_THRESHOLD: int = 5     # lock after N failed attempts
    ACCOUNT_LOCK_DURATION_MINUTES: int = 15

    # ── Storage ──────────────────────────────────────────
    STORAGE_PROVIDER: str = os.getenv("STORAGE_PROVIDER", "local")  # local | s3 | azure
    STORAGE_DIR: str = os.getenv("STORAGE_DIR", "storage")

    # ── CORS ─────────────────────────────────────────────
    CORS_ORIGINS: list[str] = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")

    # ── Roles ────────────────────────────────────────────
    ALL_ROLES = ["OWNER", "ADMIN", "ANALYST", "VIEWER", "AUDITOR"]
    ROLE_HIERARCHY = {"OWNER": 5, "ADMIN": 4, "ANALYST": 3, "VIEWER": 2, "AUDITOR": 1}


settings = Settings()
