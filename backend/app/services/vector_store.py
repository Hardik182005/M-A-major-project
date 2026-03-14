"""
ChromaDB vector store for fast semantic RAG retrieval.
Runs fully local - no API keys, no cloud, no cost.
"""
import os
import logging
from typing import List, Dict, Optional

logger = logging.getLogger(__name__)

# Lazy-loaded singleton
_chroma_client = None
_collection = None


def _get_collection():
    """Lazy-initialize ChromaDB with a persistent local collection."""
    global _chroma_client, _collection
    if _collection is not None:
        return _collection

    try:
        import chromadb
        from chromadb.config import Settings as ChromaSettings

        persist_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            "data", "chroma_db"
        )
        os.makedirs(persist_dir, exist_ok=True)

        _chroma_client = chromadb.PersistentClient(
            path=persist_dir,
            settings=ChromaSettings(anonymized_telemetry=False),
        )
        _collection = _chroma_client.get_or_create_collection(
            name="dataroom_docs",
            metadata={"hnsw:space": "cosine"},
        )
        logger.info(f"ChromaDB initialized at {persist_dir} ({_collection.count()} vectors)")
        return _collection

    except ImportError:
        logger.warning("chromadb not installed — falling back to keyword search")
        return None
    except Exception as e:
        logger.error(f"ChromaDB init failed: {e}")
        return None


def index_chunks(doc_id: int, filename: str, chunks: List[str], pages: List[int] = None):
    """
    Index document chunks into ChromaDB for semantic retrieval.
    
    Args:
        doc_id: Database document ID
        filename: Original filename
        chunks: List of text chunks
        pages: Optional list of page numbers for each chunk
    """
    collection = _get_collection()
    if collection is None or not chunks:
        return

    # Remove old vectors for this document
    try:
        existing = collection.get(where={"doc_id": str(doc_id)})
        if existing and existing["ids"]:
            collection.delete(ids=existing["ids"])
    except Exception:
        pass

    ids = [f"doc{doc_id}_chunk{i}" for i in range(len(chunks))]
    metadatas = [
        {
            "doc_id": str(doc_id),
            "filename": filename,
            "chunk_index": i,
            "page": pages[i] if pages and i < len(pages) else 0,
        }
        for i in range(len(chunks))
    ]

    # ChromaDB uses its built-in sentence-transformer embedding (free, local)
    collection.add(
        ids=ids,
        documents=chunks,
        metadatas=metadatas,
    )
    logger.info(f"Indexed {len(chunks)} chunks for doc {doc_id} ({filename})")


def search(query: str, project_doc_ids: List[int] = None, top_k: int = 3) -> List[Dict]:
    """
    Semantic search for the most relevant chunks.
    
    Args:
        query: The user's question
        project_doc_ids: Optional list of doc IDs to filter by
        top_k: Number of results to return
        
    Returns:
        List of dicts with keys: text, filename, page, score
    """
    collection = _get_collection()
    if collection is None or collection.count() == 0:
        return []

    where_filter = None
    if project_doc_ids:
        str_ids = [str(d) for d in project_doc_ids]
        if len(str_ids) == 1:
            where_filter = {"doc_id": str_ids[0]}
        else:
            where_filter = {"doc_id": {"$in": str_ids}}

    try:
        results = collection.query(
            query_texts=[query],
            n_results=min(top_k, collection.count()),
            where=where_filter,
        )
    except Exception as e:
        logger.error(f"ChromaDB search failed: {e}")
        return []

    hits = []
    if results and results["documents"]:
        for i, doc_text in enumerate(results["documents"][0]):
            meta = results["metadatas"][0][i] if results["metadatas"] else {}
            dist = results["distances"][0][i] if results["distances"] else 1.0
            hits.append({
                "text": doc_text,
                "filename": meta.get("filename", "unknown"),
                "page": meta.get("page", 0),
                "score": round(1 - dist, 3),  # Convert distance to similarity
            })

    return hits


def is_available() -> bool:
    """Check if ChromaDB is available and initialized."""
    return _get_collection() is not None
