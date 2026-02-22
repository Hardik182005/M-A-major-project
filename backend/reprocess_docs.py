import sys
import os

# Set up paths so we can import the app
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from app.db import SessionLocal
from app.models.document import Document
from app.workers.pipeline import pipeline_worker
from app.models.processing import ProcessingJob, Finding, DocumentText

def reprocess_all():
    db = SessionLocal()
    docs = db.query(Document).filter(Document.status == 'READY').all()
    print(f"Found {len(docs)} documents to reprocess.")
    
    for doc in docs:
        print(f"Reprocessing doc {doc.id} - {doc.filename}")
        # Clear old processing jobs
        db.query(ProcessingJob).filter(ProcessingJob.doc_id == doc.id).delete()
        # Clear old findings
        db.query(Finding).filter(Finding.doc_id == doc.id).delete()
        # clear text 
        db.query(DocumentText).filter(DocumentText.doc_id == doc.id).delete()
        
        job = ProcessingJob(
            project_id=doc.project_id,
            doc_id=doc.id,
            stage="QUEUED",
            progress=0,
            status="QUEUED"
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        
        # Run pipeline
        pipeline_worker.process_document(job.id)
        
    print("Done")

if __name__ == "__main__":
    reprocess_all()
