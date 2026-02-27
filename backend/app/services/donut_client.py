"""
Donut VLM client for document structure extraction (invoices, forms, tables).
"""
import json
import logging
import os
import io
from typing import Dict, Any, Optional
from pathlib import Path

logger = logging.getLogger(__name__)

# Try to import torch and transformers
try:
    import torch
    from PIL import Image
    import transformers
    from transformers import DonutProcessor, VisionEncoderDecoderModel
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    logger.warning("PyTorch/Transformers not available - Donut VLM will not work")


class DonutClient:
    """Client for Donut VLM document structure extraction."""
    
    # Schema definitions for different document types
    SCHEMAS = {
        "invoice": {
            "task": " receipt",
            "output": {
                "company_name": "",
                "company_address": "",
                "company_tax_id": "",
                "invoice_number": "",
                "invoice_date": "",
                "due_date": "",
                "line_items": [
                    {
                        "description": "",
                        "quantity": 0,
                        "unit_price": 0,
                        "total": 0
                    }
                ],
                "subtotal": 0,
                "tax": 0,
                "total": 0,
                "currency": "USD"
            }
        },
        "financial_statement": {
            "task": " financial statement",
            "output": {
                "statement_type": "",  # balance sheet, income statement, cash flow
                "period_start": "",
                "period_end": "",
                "items": [
                    {
                        "label": "",
                        "value": 0
                    }
                ],
                "currency": "USD"
            }
        },
        "contract": {
            "task": " contract",
            "output": {
                "parties": [
                    {
                        "name": "",
                        "role": ""
                    }
                ],
                "effective_date": "",
                "termination_date": "",
                "key_terms": [
                    {
                        "clause": "",
                        "summary": ""
                    }
                ],
                "obligations": [
                    {
                        "party": "",
                        "description": ""
                    }
                ]
            }
        },
        "form": {
            "task": " form",
            "output": {
                "form_type": "",
                "fields": [
                    {
                        "label": "",
                        "value": ""
                    }
                ]
            }
        }
    }
    
    def __init__(
        self,
        model_name: str = None,
        device: str = None,
    ):
        self.model_name = model_name or "nielsr/donut-base"
        self.device = device or "cpu"
        
        self.processor = None
        self.model = None
        self._loaded = False
        # Removed immediate _load_model() call for faster app startup
    
    def _load_model(self):
        """Load the Donut model and processor."""
        if self._loaded:
            return
        try:
            logger.info(f"Lazy loading Donut model: {self.model_name}...")
            
            self.processor = DonutProcessor.from_pretrained(self.model_name)
            
            # Load model
            self.model = VisionEncoderDecoderModel.from_pretrained(self.model_name)
            
            # Move to device
            if self.device == "cuda" and torch.cuda.is_available():
                self.model.to("cuda")
            else:
                self.device = "cpu"
            
            self.model.eval()
            self._loaded = True
            logger.info(f"Donut model loaded successfully on {self.device}")
            
        except Exception as e:
            logger.error(f"Failed to load Donut model: {e}")
            self.model = None
            self.processor = None
    
    def is_available(self) -> bool:
        """Check if Donut model is available (loads on demand)."""
        if not self._loaded and TORCH_AVAILABLE:
            self._load_model()
        return self.model is not None and self.processor is not None
    
    def extract_structure(
        self,
        file_path: str,
        schema_type: str = "invoice",
    ) -> Dict[str, Any]:
        """
        Extract structured data from a document using Donut.
        
        Args:
            file_path: Path to the document file
            schema_type: Type of document (invoice, financial_statement, contract, form)
        
        Returns:
            dict with extracted structured data
        """
        if not self.is_available():
            return {
                "error": "Donut model not available",
                "schema_type": schema_type,
                "data": None,
                "confidence": 0.0,
            }
        
        try:
            # Get schema
            schema = self.SCHEMAS.get(schema_type, self.SCHEMAS["invoice"])
            task_prompt = schema["task"]
            
            # Prepare image
            image = self._load_image(file_path)
            if image is None:
                return {
                    "error": "Failed to load image",
                    "schema_type": schema_type,
                    "data": None,
                    "confidence": 0.0,
                }
            
            # Prepare inputs
            decoder_input_ids = self.processor.tokenizer(
                task_prompt,
                add_special_tokens=False,
                return_tensors="pt"
            ).input_ids
            
            if self.device == "cuda":
                decoder_input_ids = decoder_input_ids.to("cuda")
            
            # Run inference
            with torch.no_grad():
                outputs = self.model(
                    image.unsqueeze(0) if image.dim() == 3 else image,
                    decoder_input_ids=decoder_input_ids,
                )
            
            # Decode output
            predicted_ids = outputs.logits.argmax(dim=-1)
            predicted_text = self.processor.batch_decode(
                predicted_ids,
                skip_special_tokens=True
            )[0]
            
            # Parse JSON
            try:
                # Try to find JSON in the output
                json_start = predicted_text.find("{")
                json_end = predicted_text.rfind("}") + 1
                
                if json_start >= 0 and json_end > json_start:
                    json_str = predicted_text[json_start:json_end]
                    data = json.loads(json_str)
                else:
                    data = {"raw_output": predicted_text}
                
                return {
                    "schema_type": schema_type,
                    "data": data,
                    "confidence": 0.75,  # Donut doesn't provide confidence, use default
                    "raw_output": predicted_text,
                }
                
            except json.JSONDecodeError:
                logger.warning(f"Failed to parse Donut JSON output: {predicted_text}")
                return {
                    "schema_type": schema_type,
                    "data": {"raw_output": predicted_text},
                    "confidence": 0.5,
                    "raw_output": predicted_text,
                }
                
        except Exception as e:
            logger.error(f"Donut extraction failed: {e}")
            return {
                "error": str(e),
                "schema_type": schema_type,
                "data": None,
                "confidence": 0.0,
            }
    
    def _load_image(self, file_path: str):
        """Load an image from file path."""
        try:
            # Check file extension
            ext = Path(file_path).suffix.lower()
            
            if ext == ".pdf":
                # Convert first page of PDF to image using PyMuPDF
                import fitz
                pdf_doc = fitz.open(file_path)
                if len(pdf_doc) > 0:
                    page = pdf_doc.load_page(0)
                    pix = page.get_pixmap()
                    image = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                else:
                    return None
            else:
                # Load image directly
                image = Image.open(file_path).convert("RGB")
            
            # Resize if too large (Donut expects max 1280x960)
            max_size = (1280, 960)
            if image.size[0] > max_size[0] or image.size[1] > max_size[1]:
                image.thumbnail(max_size, Image.Resampling.LANCZOS)
            
            # Convert to tensor
            if self.processor:
                return self.processor(image, return_tensors="pt").pixel_values.squeeze(0)
            
            return image
            
        except Exception as e:
            logger.error(f"Failed to load image: {e}")
            return None
    
    def route_to_vlm(
        self,
        doc_type: str,
        needs_vlm: bool,
        extraction_quality: float,
    ) -> bool:
        """
        Determine if a document should be processed with VLM.
        
        Args:
            doc_type: Document type from classification
            needs_vlm: Flag from classification
            extraction_quality: Text extraction quality score
        
        Returns:
            True if VLM should be used
        """
        # Route to VLM if:
        # 1. Classification says needs_vlm
        # 2. Text extraction quality is too low
        # 3. Document type is invoice/financial (likely has tables)
        
        if needs_vlm:
            return True
        
        if extraction_quality < 0.3:
            return True
        
        if doc_type in ("invoice", "financial_statement", "contract"):
            return True
        
        return False


# Singleton instance
donut_client = DonutClient()
