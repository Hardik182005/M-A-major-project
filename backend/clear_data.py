from app.db import engine
from sqlalchemy import text

with engine.connect() as conn:
    # Clear all AI-related data
    tables = [
        'document_chunks',
        'findings', 
        'doc_structured',
        'pii_entities',
        'doc_classification',
        'document_text',
        'processing_jobs',
        'audit_logs'
    ]
    
    for table in tables:
        try:
            conn.execute(text(f'DELETE FROM {table}'))
            print(f'Cleared {table}')
        except Exception as e:
            print(f'{table}: {e}')
    
    conn.commit()

print('All data cleared!')
