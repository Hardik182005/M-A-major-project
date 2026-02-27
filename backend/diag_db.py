from app.db import SessionLocal
from app.models.document import Document
from app.models.user import User

db = SessionLocal()
doc_count = db.query(Document).count()
user_count = db.query(User).count()
print(f"Documents: {doc_count}")
print(f"Users: {user_count}")
db.close()
