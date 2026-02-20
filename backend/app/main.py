from fastapi import FastAPI
from app.db import Base, engine
from app.models import User, Project, ProjectMember, Document, AuditEvent  # noqa: F401
from app.auth.routes import router as auth_router
from app.routers.projects import router as projects_router
from app.routers.documents import router as documents_router
from app.routers.audit import router as audit_router

app = FastAPI(
    title="M&A Data Room API",
    description="Secure virtual data room for M&A due diligence",
    version="1.0.0",
)

# Create tables on startup (will be replaced by Alembic migrations)
try:
    Base.metadata.create_all(bind=engine)
    print("✅ Database connected and tables created!")
except Exception as e:
    print(f"⚠️ Database connection failed: {e}")

# ── Routers ──────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(projects_router)
app.include_router(documents_router)
app.include_router(audit_router)


@app.get("/", tags=["Health"])
def home():
    return {"message": "M&A Data Room API is running 🚀"}
