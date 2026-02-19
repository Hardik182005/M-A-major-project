from fastapi import FastAPI
from app.db import Base, engine
from app.models.user import User  # noqa: F401
from app.auth.routes import router as auth_router

app = FastAPI()

try:
    Base.metadata.create_all(bind=engine)
    print("✅ Database connected and tables created!")
except Exception as e:
    print(f"⚠️ Database connection failed: {e}")

app.include_router(auth_router)

@app.get("/")
def home():
    return {"message": "DB connected + tables created"}
