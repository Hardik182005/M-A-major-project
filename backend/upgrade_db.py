from app.db import engine
from sqlalchemy import text

try:
    with engine.connect() as conn:
        conn.execute(text('ALTER TABLE users ADD COLUMN reset_token VARCHAR'))
        conn.execute(text('ALTER TABLE users ADD COLUMN reset_token_expiry TIMESTAMP'))
        conn.commit()
    print("Database updated!")
except Exception as e:
    print(f"Update failed or already updated: {e}")
