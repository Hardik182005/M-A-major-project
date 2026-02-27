from app.db import SessionLocal
from app.models.user import User

db = SessionLocal()
id = 3
user = db.query(User).filter(User.id == id).first()
if user:
    user.role = "admin"
    db.commit()
    print(f"Updated user {user.email} to 'admin' role.")
else:
    print("User not found.")
db.close()
