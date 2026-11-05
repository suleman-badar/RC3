"""Hallucination verification: a claim is supported only if its excerpt really occurs in the resume."""
import re

from rapidfuzz import fuzz


def _norm(text: str) -> str:
    text = text.lower()
    text = re.sub(r"[•▪●◦·•‣◦\-–—*|]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def verify_excerpt(excerpt: str, raw_text: str) -> bool:
    if not excerpt or not raw_text:
        return False
    ex, raw = _norm(excerpt), _norm(raw_text)
    if len(ex) < 2:
        return False
    if ex in raw:
        return True
    return fuzz.partial_ratio(ex, raw) >= 90
