"""Groq structured generation. Embeddings remain in the Gemini adapter."""
from typing import TypeVar

import httpx
from pydantic import BaseModel

from ..config import settings

T = TypeVar("T", bound=BaseModel)
BASE_URL = "https://api.groq.com/openai/v1"


def generate_json(prompt: str, schema: type[T], temperature: float = 0.2) -> T:
    response = httpx.post(
        f"{BASE_URL}/chat/completions",
        headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"},
        json={
            "model": settings.GROQ_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature,
            "response_format": {
                "type": "json_schema",
                "json_schema": {
                    "name": schema.__name__,
                    # Existing Pydantic schemas have optional/default fields.
                    "strict": False,
                    "schema": schema.model_json_schema(),
                },
            },
        },
        timeout=httpx.Timeout(25.0, connect=5.0),
    )
    response.raise_for_status()
    choice = response.json()["choices"][0]
    if choice.get("finish_reason") != "stop":
        raise ValueError("Groq did not finish a complete response")
    return schema.model_validate_json(choice["message"]["content"])


def list_models() -> list[str]:
    response = httpx.get(
        f"{BASE_URL}/models",
        headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"},
        timeout=httpx.Timeout(20.0, connect=5.0),
    )
    response.raise_for_status()
    return [model["id"] for model in response.json()["data"]]
