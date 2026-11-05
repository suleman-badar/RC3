"""Groq structured generation. Embeddings remain in the Gemini adapter."""
import time
from typing import TypeVar

import httpx
from pydantic import BaseModel

from ..config import settings

T = TypeVar("T", bound=BaseModel)
BASE_URL = "https://api.groq.com/openai/v1"
MAX_RATE_LIMIT_WAIT = 20.0  # seconds we are willing to wait for a 429 to clear inside one attempt


class GroqError(Exception):
    """A Groq failure with a short, human-readable reason (shown in the UI and logs)."""

    def __init__(self, message: str, status: int | None = None):
        super().__init__(message)
        self.status = status
        self.code = status  # read by the shared retry helper


def generate_json(prompt: str, schema: type[T], temperature: float = 0.2) -> T:
    body = {
        "model": settings.GROQ_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": temperature,
        # Resume extraction is long; without an explicit budget reasoning models can stop mid-answer.
        "max_completion_tokens": 8192,
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": schema.__name__,
                # Existing Pydantic schemas have optional/default fields.
                "strict": False,
                "schema": schema.model_json_schema(),
            },
        },
    }
    if settings.GROQ_MODEL.startswith("openai/gpt-oss"):
        body["reasoning_effort"] = "low"  # extraction needs little reasoning; keeps latency and tokens down

    try:
        response = httpx.post(
            f"{BASE_URL}/chat/completions",
            headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"},
            json=body,
            timeout=httpx.Timeout(90.0, connect=10.0),
        )
    except httpx.TimeoutException as exc:
        raise GroqError("Groq timed out after 90 s") from exc
    except httpx.HTTPError as exc:
        raise GroqError(f"Could not reach Groq ({type(exc).__name__})") from exc

    if response.status_code == 429:
        # Free-tier limits are per minute: wait as long as Groq asks (bounded), then let the caller retry.
        try:
            wait = float(response.headers.get("retry-after", "10"))
        except ValueError:
            wait = 10.0
        time.sleep(min(wait, MAX_RATE_LIMIT_WAIT))
    response.raise_for_status()  # HTTPStatusError keeps the status code for the retry helper and check scripts

    choice = response.json()["choices"][0]
    reason = choice.get("finish_reason")
    if reason == "length":
        raise GroqError("Groq response was cut off (token limit); try a shorter resume or another model", 422)
    if reason != "stop":
        raise GroqError(f"Groq stopped early ({reason})")
    content = choice["message"].get("content") or ""
    try:
        return schema.model_validate_json(content)
    except Exception as exc:
        raise GroqError(f"Groq returned JSON that does not match the expected format ({type(exc).__name__})", 422) from exc


def list_models() -> list[str]:
    response = httpx.get(
        f"{BASE_URL}/models",
        headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"},
        timeout=httpx.Timeout(20.0, connect=5.0),
    )
    response.raise_for_status()
    return [model["id"] for model in response.json()["data"]]
