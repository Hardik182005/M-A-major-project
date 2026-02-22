"""Add AI pipeline tables

Revision ID: ai_pipeline_001
Revises: 
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'ai_pipeline_001'
down_revision = '7b97afb7589d'  # Update with your latest revision
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Processing Jobs table
    op.create_table(
        'processing_jobs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('doc_id', sa.Integer(), nullable=False),
        sa.Column('batch_id', sa.String(64), nullable=True),
        sa.Column('stage', sa.String(50), nullable=True),
        sa.Column('progress', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(30), nullable=True),
        sa.Column('eta_seconds', sa.Integer(), nullable=True),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('error_code', sa.String(50), nullable=True),
        sa.Column('error_msg', sa.Text(), nullable=True),
        sa.Column('retry_count', sa.Integer(), nullable=True),
        sa.Column('max_retries', sa.Integer(), nullable=True),
        sa.Column('worker_id', sa.String(100), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['doc_id'], ['documents.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_processing_jobs_id', 'processing_jobs', ['id'])
    op.create_index('ix_processing_jobs_batch_id', 'processing_jobs', ['batch_id'])
    
    # Document Text table
    op.create_table(
        'document_text',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('doc_id', sa.Integer(), nullable=False),
        sa.Column('text', sa.Text(), nullable=True),
        sa.Column('pages_json', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('page_count', sa.Integer(), nullable=True),
        sa.Column('char_count', sa.Integer(), nullable=True),
        sa.Column('extraction_method', sa.String(50), nullable=True),
        sa.Column('extraction_quality', sa.Float(), nullable=True),
        sa.Column('needs_vlm', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['doc_id'], ['documents.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('doc_id')
    )
    op.create_index('ix_document_text_id', 'document_text', ['id'])
    
    # PII Entities table
    op.create_table(
        'pii_entities',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('doc_id', sa.Integer(), nullable=False),
        sa.Column('page', sa.Integer(), nullable=True),
        sa.Column('start', sa.Integer(), nullable=True),
        sa.Column('end', sa.Integer(), nullable=True),
        sa.Column('label', sa.String(50), nullable=False),
        sa.Column('original_text', sa.Text(), nullable=True),
        sa.Column('replacement', sa.String(100), nullable=True),
        sa.Column('confidence', sa.Float(), nullable=True),
        sa.Column('detection_method', sa.String(50), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['doc_id'], ['documents.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_pii_entities_id', 'pii_entities', ['id'])
    
    # Document Classification table
    op.create_table(
        'doc_classification',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('doc_id', sa.Integer(), nullable=False),
        sa.Column('doc_type', sa.String(100), nullable=True),
        sa.Column('sensitivity', sa.String(20), nullable=True),
        sa.Column('confidence', sa.Float(), nullable=True),
        sa.Column('tags', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('needs_vlm', sa.Boolean(), nullable=True),
        sa.Column('raw_output', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['doc_id'], ['documents.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('doc_id')
    )
    op.create_index('ix_doc_classification_id', 'doc_classification', ['id'])
    
    # Document Structured table
    op.create_table(
        'doc_structured',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('doc_id', sa.Integer(), nullable=False),
        sa.Column('schema_type', sa.String(50), nullable=True),
        sa.Column('json_blob', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('confidence', sa.Float(), nullable=True),
        sa.Column('source_page', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['doc_id'], ['documents.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_doc_structured_id', 'doc_structured', ['id'])
    
    # Findings table
    op.create_table(
        'findings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('doc_id', sa.Integer(), nullable=False),
        sa.Column('category', sa.String(50), nullable=False),
        sa.Column('type', sa.String(100), nullable=True),
        sa.Column('severity', sa.String(20), nullable=False),
        sa.Column('status', sa.String(30), nullable=True),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('evidence_page', sa.Integer(), nullable=True),
        sa.Column('evidence_quote', sa.Text(), nullable=True),
        sa.Column('evidence_span_start', sa.Integer(), nullable=True),
        sa.Column('evidence_span_end', sa.Integer(), nullable=True),
        sa.Column('confidence', sa.Float(), nullable=True),
        sa.Column('tags', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['doc_id'], ['documents.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_findings_id', 'findings', ['id'])
    
    # Document Chunks table (for RAG)
    op.create_table(
        'document_chunks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('doc_id', sa.Integer(), nullable=False),
        sa.Column('chunk_text', sa.Text(), nullable=False),
        sa.Column('chunk_index', sa.Integer(), nullable=False),
        sa.Column('page', sa.Integer(), nullable=True),
        sa.Column('section', sa.String(100), nullable=True),
        sa.Column('embedding', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('char_count', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['doc_id'], ['documents.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_document_chunks_id', 'document_chunks', ['id'])
    
    # Add page_count column to documents table
    op.add_column('documents', sa.Column('page_count', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('documents', 'page_count')
    op.drop_table('document_chunks')
    op.drop_table('findings')
    op.drop_table('doc_structured')
    op.drop_table('doc_classification')
    op.drop_table('pii_entities')
    op.drop_table('document_text')
    op.drop_table('processing_jobs')
