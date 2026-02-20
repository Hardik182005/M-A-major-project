import logging
import uuid
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings
from app.db import Base, engine
from app.models import User, Project, ProjectMember, Document, AuditEvent, RefreshToken  # noqa: F401
from app.auth.routes import router as auth_router
from app.routers.projects import router as projects_router
from app.routers.documents import router as documents_router
from app.routers.audit import router as audit_router

# ── Structured Logging ───────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("dataroom")


# ── FastAPI App ──────────────────────────────────────────
app = FastAPI(
    title="M&A Data Room API",
    description="Secure virtual data room for M&A due diligence",
    version="1.0.0",
)

# ── CORS ─────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request ID Middleware ────────────────────────────────
class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())[:8]
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


app.add_middleware(RequestIDMiddleware)


# ── DB Startup ───────────────────────────────────────────
try:
    Base.metadata.create_all(bind=engine)
    logger.info("Database connected and tables created")
except Exception as e:
    logger.error(f"Database connection failed: {e}")

# ── Routers ──────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(projects_router)
app.include_router(documents_router)
app.include_router(audit_router)


@app.get("/", tags=["Health"])
def home():
    return {
        "service": "M&A Data Room API",
        "version": "1.0.0",
        "status": "running",
        "storage_provider": settings.STORAGE_PROVIDER,
    }
