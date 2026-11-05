"""Shared AI facade: selectable Gemini/Groq generation and Gemini embeddings.

All AI output in Evident goes through these two functions. There is no
fallback content: if a provider fails, AIError is raised and callers surface an
honest failure state.
"""
import json
import logging
import time
from typing import TypeVar

import numpy as np
from pydantic import BaseModel

from ..config import settings

log = logging.getLogger("evident.gemini")
T = TypeVar("T", bound=BaseModel)

_client = None
_embed_cache: dict[str, list[float]] = {}
EMBED_DIM = 768


class AIError(Exception):
    pass


def _get_client():
    global _client
    if _client is None:
        if not settings.GEMINI_API_KEY:
            raise AIError("GEMINI_API_KEY is not configured on the server")
        from google import genai

        _client = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _client


def _retry(fn, what: str, attempts: int = 3):
    delay = 1.0
    last = None
    for attempt in range(attempts):
        try:
            return fn()
        except AIError:
            raise
        except Exception as exc:  # network, quota, 5xx
            last = exc
            code = getattr(exc, "code", None) or getattr(getattr(exc, "response", None), "status_code", None)
            log.warning("AI %s failed (attempt %s, HTTP %s, %s)", what, attempt + 1, code, type(exc).__name__)
            if isinstance(code, int) and 400 <= code < 500 and code != 429:
                break
            if attempt < attempts - 1:
                time.sleep(delay)
                delay *= 2
    status = getattr(getattr(last, "response", None), "status_code", None)
    hints = {400: "invalid request or model parameters", 401: "authentication failed, check the API key",
             403: "access denied for this key", 404: "model not available for this key",
             413: "request too large for the model", 429: "rate limit or quota reached, wait a minute and retry"}
    if isinstance(status, int):  # summarise HTTP errors; never surface raw provider text or keys
        detail = f"HTTP {status}, {hints.get(status, 'provider error')}"
    else:
        detail = str(last)[:220] if last else "unknown error"
    raise AIError(f"AI service unavailable ({what}): {detail}") from last


def generate_json(prompt: str, schema: type[T], temperature: float = 0.2) -> T:
    if settings.AI_PROVIDER == "groq":
        if not settings.GROQ_API_KEY.strip() or settings.GROQ_API_KEY.startswith("your-"):
            raise AIError("GROQ_API_KEY is not configured on the server")
        from . import groq

        try:
            return _retry(lambda: groq.generate_json(prompt, schema, temperature), "Groq generation", attempts=2)
        except AIError as groq_error:
            # Opt-in only (GROQ_FALLBACK_TO_GEMINI=true): by default Groq mode never calls Gemini for generation.
            if not settings.GROQ_FALLBACK_TO_GEMINI or not settings.GEMINI_API_KEY.strip() \
                    or settings.GEMINI_API_KEY.startswith("your-"):
                raise
            log.warning("Groq failed (%s); falling back to Gemini generation", groq_error)
            try:
                return _gemini_generate(prompt, schema, temperature)
            except AIError as gemini_error:
                raise AIError(f"{groq_error} | Gemini fallback also failed: {gemini_error}") from gemini_error
    return _gemini_generate(prompt, schema, temperature)


def _gemini_generate(prompt: str, schema: type[T], temperature: float) -> T:

    from google.genai import types

    def call():
        resp = _get_client().models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=schema,
                temperature=temperature,
            ),
        )
        if getattr(resp, "parsed", None) is not None:
            parsed = resp.parsed
            return parsed if isinstance(parsed, schema) else schema.model_validate(parsed)
        text = resp.text or ""
        return schema.model_validate(json.loads(text))

    return _retry(call, "generate")


def _normalize(vec: list[float]) -> list[float]:
    arr = np.asarray(vec, dtype=np.float32)
    norm = float(np.linalg.norm(arr))
    return (arr / norm).tolist() if norm > 0 else arr.tolist()


def embed(texts: list[str]) -> list[list[float]]:
    """Embed texts (L2-normalized). Uses an in-process cache and batches of 100."""
    from google.genai import types

    texts = [t.strip()[:2000] or "-" for t in texts]
    missing = [t for t in dict.fromkeys(texts) if t not in _embed_cache]
    for i in range(0, len(missing), 100):
        batch = missing[i : i + 100]

        def call(batch=batch):
            r = _get_client().models.embed_content(
                model=settings.GEMINI_EMBED_MODEL,
                contents=batch,
                config=types.EmbedContentConfig(
                    task_type="SEMANTIC_SIMILARITY", output_dimensionality=EMBED_DIM
                ),
            )
            return [e.values for e in r.embeddings]

        vectors = _retry(call, "embed")
        if len(vectors) != len(batch):
            raise AIError("Embedding count mismatch")
        for t, v in zip(batch, vectors):
            _embed_cache[t] = _normalize(v)
    return [_embed_cache[t] for t in texts]


def cosine_matrix(query_vecs: list[list[float]], doc_vecs: list[list[float]]) -> np.ndarray:
    if not query_vecs or not doc_vecs:
        return np.zeros((len(query_vecs), len(doc_vecs)))
    q = np.asarray(query_vecs, dtype=np.float32)
    d = np.asarray(doc_vecs, dtype=np.float32)
    return q @ d.T
