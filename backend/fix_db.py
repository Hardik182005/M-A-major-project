from app.db import engine
from sqlalchemy import text

with engine.connect() as conn:
    # Add page_count column
    try:
        conn.execute(text('ALTER TABLE documents ADD COLUMN page_count INTEGER'))
        print('Added page_count column')
    except Exception as e:
        print(f'page_count: {e}')
    
    conn.commit()

print('Database fix complete!')
