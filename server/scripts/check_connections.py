"""Read-only setup check: python -m scripts.check_connections [--ai]."""
import argparse
import logging


def _configured(value: str) -> bool:
    value = value.strip().lower()
    return bool(value) and not any(
        marker in value
        for marker in ("your-", "replace-", "change-me", "placeholder", "test-key", "<", ">")
    )


def _database_hint(uri: str) -> None:
    if uri.startswith("mongodb+srv://") or ".mongodb.net" in uri:
        print(
            "  Atlas: allow your current public IP in Network Access and check the"
            " database user in Database Access (not your Atlas account login)."
        )
        print(
            "  Copy Connect > Drivers > Python into MONGODB_URI; replace the password"
            " placeholder and percent-encode reserved characters in credentials."
        )
    else:
        print(
            "  Local MongoDB: start MongoDB on the configured host/port. For Atlas,"
            " replace MONGODB_URI in server/.env with its Connect > Drivers URI."
        )


def _check_database(settings) -> bool:
    uri = settings.MONGODB_URI.strip()
    if not _configured(uri) or not uri.startswith(("mongodb://", "mongodb+srv://")):
        print("[FAIL] MONGODB_URI is missing, contains placeholders, or has an invalid scheme.")
        _database_hint(uri)
        return False
    try:
        from pymongo import MongoClient
        from pymongo.errors import (
            ConfigurationError,
            ConnectionFailure,
            InvalidURI,
            OperationFailure,
            PyMongoError,
        )
    except ImportError:
        print("[FAIL] MongoDB dependencies missing. Run: python -m pip install -r requirements.txt")
        return False
    try:
        with MongoClient(
            uri,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
            socketTimeoutMS=5000,
            timeoutMS=5000,
        ) as client:
            client[settings.MONGODB_DB].command("ping")
        print("[OK] MongoDB connection and authentication passed a read-only ping.")
        return True
    except OperationFailure:
        print("[FAIL] MongoDB rejected authentication or access. Check database user credentials.")
    except (InvalidURI, ConfigurationError):
        print("[FAIL] MongoDB connection settings or SRV/DNS lookup are invalid.")
    except ConnectionFailure:
        print("[FAIL] MongoDB could not be reached within the connection timeout.")
    except PyMongoError:
        print("[FAIL] MongoDB rejected the connection. Check the URI, TLS, and network settings.")
    except Exception:
        print("[FAIL] MongoDB check failed. Check the database name and connection settings.")
    _database_hint(uri)
    return False


def _ai_failure(operation: str, exc: Exception, provider: str = "Gemini") -> None:
    # Inspect structured error codes, never print raw provider messages or keys.
    cause = exc
    seen = set()
    while cause.__cause__ is not None and id(cause) not in seen:
        seen.add(id(cause))
        cause = cause.__cause__
    code = getattr(cause, "code", None) or getattr(getattr(cause, "response", None), "status_code", None)
    hints = {
        400: "Invalid request or API key. Check the key and the model's supported parameters.",
        401: "Authentication failed. Check the provider API key in server/.env.",
        402: "Payment required. Check your project's billing or credits in the provider console.",
        403: "Access denied. Check key restrictions and project verification/billing in the provider console.",
        404: "Model unavailable for this key. Run python -m scripts.check_ai --list-models and update the model in server/.env.",
        429: "Quota or rate limit reached. Check usage and available quota in the provider console.",
        500: "Provider returned a server error. Retry later.",
        503: "Provider service is temporarily unavailable. Retry later.",
        504: "Provider request timed out. Retry later.",
    }
    if isinstance(code, int) and code in hints:
        print(f"[FAIL] {provider} {operation} failed (HTTP {code}). {hints[code]}")
    elif isinstance(cause, (ConnectionError, TimeoutError, OSError)) or type(cause).__name__ in {
        "ConnectError", "ConnectTimeout", "ReadTimeout", "ProxyError",
    }:
        print(f"[FAIL] {provider} {operation} could not connect or timed out. Check network, firewall, and proxy settings.")
    else:
        print(f"[FAIL] {provider} {operation} failed. Check the API key, model, quota, network, and response format.")


def _check_ai(check_generation: bool = True, check_embeddings: bool = True) -> bool:
    try:
        from pydantic import BaseModel

        from app.services import gemini
        from app.config import settings
    except ImportError:
        print("[FAIL] AI dependencies missing. Run: python -m pip install -r requirements.txt")
        return False

    class Ping(BaseModel):
        answer: str

    # Keep retry logs out of this report and show one actionable result per probe.
    logger = logging.getLogger("evident.gemini")
    was_disabled = logger.disabled
    logger.disabled = True
    passed = True
    try:
        if check_generation:
            try:
                result = gemini.generate_json('Reply with JSON {"answer": "pong"}', Ping)
                if result.answer.strip().lower() != "pong":
                    raise ValueError("Unexpected response")
                print(f"[OK] {settings.AI_PROVIDER.title()} JSON generation passed.")
            except Exception as exc:
                _ai_failure("generation", exc, settings.AI_PROVIDER.title())
                passed = False
        if check_embeddings:
            try:
                vectors = gemini.embed(["Connection check: Python developer"])
                if len(vectors) != 1 or len(vectors[0]) != gemini.EMBED_DIM:
                    raise ValueError("Unexpected embedding shape")
                print("[OK] Gemini embeddings passed (768 dimensions).")
            except Exception as exc:
                _ai_failure("embedding", exc)
                passed = False
    finally:
        logger.disabled = was_disabled
    return passed


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ai", action="store_true", help="also test the selected generation provider and Gemini embeddings")
    args = parser.parse_args(argv)
    try:
        from app.config import settings
    except ImportError:
        print("[FAIL] Backend dependencies missing. Run: python -m pip install -r requirements.txt")
        return 1
    except Exception:
        print("[FAIL] Settings could not be loaded. Check server/.env values and formatting.")
        return 1

    passed = True
    if _configured(settings.JWT_SECRET) and len(settings.JWT_SECRET.strip()) >= 32:
        print("[OK] JWT_SECRET is set and at least 32 characters long.")
    else:
        print("[FAIL] Set JWT_SECRET in server/.env to a randomly generated secret of at least 32 characters.")
        passed = False

    generation_ready = _configured(settings.generation_api_key)
    embeddings_ready = _configured(settings.GEMINI_API_KEY)
    required_keys = {"GEMINI_API_KEY": embeddings_ready}
    if settings.AI_PROVIDER == "groq":
        required_keys["GROQ_API_KEY"] = generation_ready
    print(f"[INFO] Generation: {settings.AI_PROVIDER} / {settings.generation_model}; embeddings: Gemini.")
    for key, ready in required_keys.items():
        if ready:
            print(f"[OK] {key} is set; validity requires the --ai check.")
        else:
            print(f"[FAIL] Set {key} in server/.env.")
            passed = False

    passed = _check_database(settings) and passed
    if args.ai:
        if not generation_ready:
            print("[SKIP] Generation requires the selected provider's API key.")
        if not embeddings_ready:
            print("[SKIP] Embeddings require GEMINI_API_KEY.")
        passed = _check_ai(generation_ready, embeddings_ready) and passed
    else:
        print("[INFO] No AI requests sent. Add --ai to test providers after configuring keys.")
    print("Setup checks passed." if passed else "Setup is incomplete; resolve the failures above and rerun.")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
