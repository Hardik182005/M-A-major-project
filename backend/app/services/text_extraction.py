"""
Text extraction service for extracting text from various document formats.
"""
import logging
import os
from typing import Dict, Any, List, Optional
from pathlib import Path

logger = logging.getLogger(__name__)

# Try to import PDF libraries
try:
    import pypdf
    from pypdf import PdfReader
    PYPDF_AVAILABLE = True
except ImportError:
    PYPDF_AVAILABLE = False
    logger.warning("pypdf not available, PDF text extraction will be limited")

try:
    from pdfminer.high_level import extract_text
    from pdfminer.layout import LAParams
    PDFMINER_AVAILABLE = True
except ImportError:
    PDFMINER_AVAILABLE = False
    logger.warning("pdfminer.six not available")


class TextExtractor:
    """Extract text from documents (PDFs, images, etc.)."""
    
    def __init__(self):
        self.supported_types = {
            "application/pdf": self._extract_pdf,
            "text/plain": self._extract_text,
        }
    
    def extract(self, file_path: str, file_type: str = None) -> Dict[str, Any]:
        """
        Extract text from a file.
        
        Returns:
            dict with text, pages_json, page_count, char_count, extraction_method, quality
        """
        if not os.path.exists(file_path):
            return {
                "error": "File not found",
                "text": None,
                "pages_json": None,
                "page_count": 0,
                "char_count": 0,
                "extraction_method": None,
                "quality": 0.0,
            }
        
        # Determine file type
        if not file_type:
            ext = Path(file_path).suffix.lower()
            file_type = self._get_mime_type(ext)
        
        # Get extraction function
        extractor = self.supported_types.get(file_type)
        
        if not extractor:
            logger.warning(f"No extractor for file type: {file_type}")
            return {
                "error": f"Unsupported file type: {file_type}",
                "text": None,
                "pages_json": None,
                "page_count": 0,
                "char_count": 0,
                "extraction_method": None,
                "quality": 0.0,
            }
        
        try:
            return extractor(file_path)
        except Exception as e:
            logger.error(f"Text extraction failed: {e}")
            return {
                "error": str(e),
                "text": None,
                "pages_json": None,
                "page_count": 0,
                "char_count": 0,
                "extraction_method": None,
                "quality": 0.0,
            }
    
    def _get_mime_type(self, extension: str) -> str:
        """Map file extension to MIME type."""
        mime_map = {
            ".pdf": "application/pdf",
            ".txt": "text/plain",
            ".md": "text/plain",
            ".csv": "text/csv",
            ".json": "application/json",
        }
        return mime_map.get(extension, "application/octet-stream")
    
    def _extract_pdf(self, file_path: str) -> Dict[str, Any]:
        """Extract text from PDF using pypdf or pdfminer."""
        pages_text = []
        
        # Try pypdf first (faster)
        if PYPDF_AVAILABLE:
            try:
                reader = PdfReader(file_path)
                page_count = len(reader.pages)
                
                for i, page in enumerate(reader.pages):
                    text = page.extract_text()
                    pages_text.append(text or "")
                
                if self._calculate_quality(pages_text) > 0.3:
                    return self._build_result(pages_text, "pypdf")
                    
            except Exception as e:
                logger.warning(f"pypdf extraction failed: {e}")
        
        # Fall back to pdfminer
        if PDFMINER_AVAILABLE:
            try:
                laparams = LAParams()
                text = extract_text(file_path, laparams=laparams)
                
                # Split by page markers (form feed)
                page_texts = text.split("\f")
                pages_text = [p.strip() for p in page_texts if p.strip()]
                
                if not pages_text:
                    # Try reading page by page
                    reader = pypdf.PdfReader(file_path) if PYPDF_AVAILABLE else None
                    if reader:
                        for page in reader.pages:
                            text = page.extract_text()
                            if text:
                                pages_text.append(text)
                
                if pages_text:
                    return self._build_result(pages_text, "pdfminer")
                    
            except Exception as e:
                logger.warning(f"pdfminer extraction failed: {e}")
        
        # If both failed, return empty with low quality
        logger.error(f"PDF text extraction failed for {file_path}")
        return {
            "text": "",
            "pages_json": [],
            "page_count": 0,
            "char_count": 0,
            "extraction_method": "failed",
            "quality": 0.0,
            "needs_vlm": True,  # Need VLM for scanned PDFs
        }
    
    def _extract_text(self, file_path: str) -> Dict[str, Any]:
        """Extract text from plain text files."""
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                text = f.read()
            
            pages_text = [text]  # Treat as single page
            return self._build_result(pages_text, "text")
            
        except UnicodeDecodeError:
            # Try with different encoding
            with open(file_path, "r", encoding="latin-1") as f:
                text = f.read()
            pages_text = [text]
            return self._build_result(pages_text, "text")
    
    def _build_result(self, pages_text: List[str], method: str) -> Dict[str, Any]:
        """Build the result dict from extracted pages."""
        full_text = "\n\n--- Page Break ---\n\n".join(pages_text)
        char_count = len(full_text)
        quality = self._calculate_quality(pages_text)
        
        return {
            "text": full_text,
            "pages_json": pages_text,
            "page_count": len(pages_text),
            "char_count": char_count,
            "extraction_method": method,
            "quality": quality,
            "needs_vlm": quality < 0.3,  # Low quality means need VLM
        }
    
    def _calculate_quality(self, pages_text: List[str]) -> float:
        """
        Calculate extraction quality based on text characteristics.
        
        Quality factors:
        - Non-empty pages
        - Reasonable text density
        - Contains expected characters (not garbled)
        """
        if not pages_text:
            return 0.0
        
        total_chars = sum(len(p) for p in pages_text)
        avg_chars_per_page = total_chars / len(pages_text) if pages_text else 0
        
        # Check for empty pages
        empty_pages = sum(1 for p in pages_text if len(p.strip()) < 50)
        empty_ratio = empty_pages / len(pages_text)
        
        # Check text density (reasonable: 500-10000 chars per page for a document)
        good_density_pages = sum(
            1 for p in pages_text 
            if 100 < len(p.strip()) < 50000
        )
        density_ratio = good_density_pages / len(pages_text)
        
        # Calculate quality score
        quality = (
            (1.0 - empty_ratio) * 0.4 +  # Less empty pages = better
            density_ratio * 0.4 +  # Better density = better
            (1.0 if avg_chars_per_page > 500 else avg_chars_per_page / 500) * 0.2  # More content = better
        )
        
        return min(1.0, max(0.0, quality))
    
    def get_file_path(self, storage_key: str, base_dir: str = None) -> str:
        """Get full file path from storage key."""
        if base_dir is None:
            from app.config import settings
            base_dir = settings.STORAGE_DIR
        
        # storage_key is relative to the storage directory
        return os.path.join(base_dir, storage_key)


# Singleton instance
text_extractor = TextExtractor()
