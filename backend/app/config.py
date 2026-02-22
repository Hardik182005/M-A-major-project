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

    # ── AI Pipeline ─────────────────────────────────────
    # Ollama (SLM/LLM)
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "gemma3:270m")
    OLLAMA_CLASSIFICATION_MODEL: str = os.getenv("OLLAMA_CLASSIFICATION_MODEL", "gemma3:270m")
    OLLAMA_PII_MODEL: str = os.getenv("OLLAMA_PII_MODEL", "gemma3:270m")
    OLLAMA_ANALYSIS_MODEL: str = os.getenv("OLLAMA_ANALYSIS_MODEL", "gemma3:270m")
    OLLAMA_TIMEOUT: int = int(os.getenv("OLLAMA_TIMEOUT", "120"))

    # Donut (VLM)
    DONUT_MODEL_NAME: str = os.getenv("DONUT_MODEL_NAME", "naver-clova-ix/donut-base-finetuned-cord")
    DONUT_DEVICE: str = os.getenv("DONUT_DEVICE", "cpu")  # cpu or cuda

    # Processing
    ENABLE_AUTO_PROCESSING: bool = os.getenv("ENABLE_AUTO_PROCESSING", "true").lower() == "true"
    MAX_TEXT_LENGTH_FOR_CLASSIFICATION: int = int(os.getenv("MAX_TEXT_LENGTH_FOR_CLASSIFICATION", "12000"))
    TEXT_EXTRACTION_QUALITY_THRESHOLD: float = float(os.getenv("TEXT_EXTRACTION_QUALITY_THRESHOLD", "0.3"))

    # Worker
    WORKER_POLL_INTERVAL: int = int(os.getenv("WORKER_POLL_INTERVAL", "5"))
    WORKER_MAX_RETRIES: int = int(os.getenv("WORKER_MAX_RETRIES", "3"))


settings = Settings()
