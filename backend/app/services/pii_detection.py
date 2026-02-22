"""
PII detection service with rule-based patterns and replacement token generation.
"""
import re
import logging
from typing import Dict, Any, List, Tuple
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class PIIEntity:
    """Represents a PII entity found in text."""
    label: str
    text: str
    start: int
    end: int
    confidence: float


class PIIDetector:
    """Rule-based PII detector with replacement token generation."""
    
    # PII patterns
    PATTERNS = {
        "EMAIL": [
            (r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', 0.95),
        ],
        "PHONE": [
            (r'\b\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b', 0.90),
            (r'\b[0-9]{3}[-.\s][0-9]{3}[-.\s][0-9]{4}\b', 0.85),
        ],
        "SSN": [
            (r'\b[0-9]{3}[-\s]?[0-9]{2}[-\s]?[0-9]{4}\b', 0.98),
        ],
        "PAN": [
            (r'\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b', 0.95),  # Indian PAN
        ],
        "GST": [
            (r'\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9]{1}[A-Z]{1}[0-9]{1}\b', 0.95),  # Indian GST
        ],
        "CREDIT_CARD": [
            (r'\b[0-9]{4}[-\s]?[0-9]{4}[-\s]?[0-9]{4}[-\s]?[0-9]{4}\b', 0.95),
        ],
        "BANK_ACCOUNT": [
            (r'\b(?:Account|Acct|A/C)[#:\s]*[0-9]{8,17}\b', 0.85),
            (r'\b[0-9]{8,17}\b', 0.50),  # Generic account number (low confidence)
        ],
        "DATE": [
            (r'\b(?:[0-9]{1,2}[-/][0-9]{1,2}[-/][0-9]{2,4})\b', 0.70),
            (r'\b(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+[0-9]{1,2},?\s+[0-9]{4})\b', 0.80),
        ],
    }
    
    # Replacement token counters
    token_counters: Dict[str, int] = {}
    
    def __init__(self):
        self.token_counters = {
            "PERSON": 0,
            "ORGANIZATION": 0,
            "ADDRESS": 0,
            "DATE": 0,
            "ACCOUNT": 0,
        }
    
    def detect(self, text: str) -> List[Dict[str, Any]]:
        """
        Detect PII entities in text.
        
        Returns:
            List of dicts with label, text, start, end, confidence
        """
        entities = []
        
        # Run pattern-based detection
        for label, patterns in self.PATTERNS.items():
            for pattern, confidence in patterns:
                for match in re.finditer(pattern, text):
                    # Avoid duplicates
                    is_duplicate = any(
                        match.start() == e["start"] and match.end() == e["end"]
                        for e in entities
                    )
                    
                    if not is_duplicate:
                        entities.append({
                            "label": label,
                            "text": match.group(),
                            "start": match.start(),
                            "end": match.end(),
                            "confidence": confidence,
                            "detection_method": "rule-based",
                        })
        
        # Sort by position
        entities.sort(key=lambda x: x["start"])
        
        return entities
    
    def pseudonymize(self, text: str, entities: List[Dict[str, Any]] = None) -> Tuple[str, List[Dict[str, Any]]]:
        """
        Replace PII entities with pseudonymous tokens.
        
        Returns:
            Tuple of (pseudonymized_text, list of replacements)
        """
        if entities is None:
            entities = self.detect(text)
        
        # Sort by position (reverse order to replace from end)
        sorted_entities = sorted(entities, key=lambda x: x["start"], reverse=True)
        
        replacements = []
        pseudonymized = text
        
        for entity in sorted_entities:
            label = entity["label"]
            original_text = entity["text"]
            
            # Generate replacement token
            replacement = self._generate_token(label)
            
            # Replace in text
            pseudonymized = (
                pseudonymized[:entity["start"]] +
                replacement +
                pseudonymized[entity["end"]:]
            )
            
            replacements.append({
                "label": label,
                "original_text": original_text,
                "replacement": replacement,
                "confidence": entity["confidence"],
            })
        
        return pseudonymized, replacements
    
    def _generate_token(self, label: str) -> str:
        """Generate a replacement token for a PII label."""
        # Map labels to token prefixes
        token_map = {
            "PERSON": "PERSON",
            "ORGANIZATION": "ORG",
            "ADDRESS": "ADDRESS",
            "EMAIL": "EMAIL",
            "PHONE": "PHONE",
            "SSN": "SSN",
            "PAN": "ID",
            "GST": "ID",
            "CREDIT_CARD": "CARD",
            "BANK_ACCOUNT": "ACCOUNT",
            "DATE": "DATE",
        }
        
        prefix = token_map.get(label, "ENTITY")
        
        # Increment counter
        if label not in self.token_counters:
            self.token_counters[label] = 0
        self.token_counters[label] += 1
        
        return f"{prefix}_{self.token_counters[label]}"
    
    def reset_counters(self):
        """Reset token counters (call for each new document)."""
        for key in self.token_counters:
            self.token_counters[key] = 0


# Singleton instance
pii_detector = PIIDetector()
