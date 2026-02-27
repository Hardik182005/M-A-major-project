from app.db import SessionLocal
from app.models.project import Project

db = SessionLocal()
projects = db.query(Project).all()
for p in projects:
    print(f"Project ID: {p.id}, Name: {p.name}, Created By: {p.created_by}")
db.close()
