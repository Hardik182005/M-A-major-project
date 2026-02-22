from app.db import engine
from sqlalchemy import text

with engine.connect() as conn:
    # Clear all tables in correct order (respecting foreign keys)
    tables = [
        'document_chunks',
        'findings',
        'doc_structured',
        'pii_entities',
        'doc_classification',
        'document_text',
        'processing_jobs',
        'documents',  # Clear documents
        'project_members',  # Clear members before projects
        'projects',  # Clear projects last
    ]
    
    for table in tables:
        try:
            conn.execute(text(f'DELETE FROM {table}'))
            print(f'Cleared {table}')
        except Exception as e:
            print(f'{table}: {e}')
    
    conn.commit()

print('\n✅ All data cleared!')
print('Please refresh the browser.')
