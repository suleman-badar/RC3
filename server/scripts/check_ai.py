"""Check the selected AI provider and Gemini embeddings, or list models."""
import argparse

from app.config import settings
from scripts.check_connections import _ai_failure, _check_ai, _configured


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--list-models", action="store_true", help="list selected generation provider and Gemini models")
    parser.add_argument("--generation-only", action="store_true", help="skip Gemini embeddings/models")
    args = parser.parse_args()
    generation_ready = _configured(settings.generation_api_key)
    embeddings_ready = _configured(settings.GEMINI_API_KEY)
    print(f"Generation: {settings.AI_PROVIDER} / {settings.generation_model}")
    passed = generation_ready and (args.generation_only or embeddings_ready)
    if not generation_ready:
        print(f"[FAIL] Set {settings.AI_PROVIDER.upper()}_API_KEY in server/.env.")
    if not args.generation_only and not embeddings_ready:
        print("[FAIL] Set GEMINI_API_KEY in server/.env for embeddings.")
    if args.list_models:
        if settings.AI_PROVIDER == "groq" and generation_ready:
            try:
                from app.services.groq import list_models

                for name in list_models():
                    print("Groq model:", name)
                print("Choose a model supporting JSON Schema; not every listed model supports it.")
            except Exception as exc:
                _ai_failure("model listing", exc, "Groq")
                passed = False
        if embeddings_ready and (settings.AI_PROVIDER == "gemini" or not args.generation_only):
            try:
                from google import genai
                from google.genai import types

                with genai.Client(api_key=settings.GEMINI_API_KEY, http_options=types.HttpOptions(timeout=20000)) as client:
                    for model in client.models.list():
                        print("Gemini model:", model.name, "| actions:", ", ".join(model.supported_actions or []))
            except Exception as exc:
                _ai_failure("model listing", exc)
                passed = False
    else:
        passed = _check_ai(generation_ready, embeddings_ready and not args.generation_only) and passed
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
