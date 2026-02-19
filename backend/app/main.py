from fastapi import FastAPI
from app.db import Base, engine
from app.models.user import User  # noqa: F401

app = FastAPI()

Base.metadata.create_all(bind=engine)

@app.get("/")
def home():
    return {"message": "DB connected + tables created"}
