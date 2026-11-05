"""Test setup: in-memory Mongo (mongomock) and a deterministic local embedding function.

The fake embedder exists ONLY for automated tests so they run offline and fast.
The application itself always calls the real Gemini API.
"""
import hashlib
import os
import re

os.environ["MONGODB_URI"] = "mongomock://localhost"
os.environ["MONGODB_DB"] = "evident_test"
os.environ["GEMINI_API_KEY"] = "test-key"
os.environ["SEM_THRESHOLD"] = "0.5"

import numpy as np  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import db as dbmod  # noqa: E402
from app.services import gemini  # noqa: E402


def fake_embed(texts):
    out = []
    for t in texts:
        v = np.zeros(gemini.EMBED_DIM, dtype=np.float32)
        for tok in re.findall(r"[a-z0-9]+", t.lower().replace("postgresql", "postgres")):
            if tok in ("skill", "education", "project", "technologies"):
                continue
            v[int(hashlib.md5(tok.encode()).hexdigest(), 16) % gemini.EMBED_DIM] += 1
        n = np.linalg.norm(v)
        out.append((v / n if n else v).tolist())
    return out


def fake_generate(prompt, schema, temperature=0.2):
    raise gemini.AIError("generation disabled in tests")


@pytest.fixture(autouse=True)
def _patch(monkeypatch):
    monkeypatch.setattr(gemini, "embed", fake_embed)
    monkeypatch.setattr(gemini, "generate_json", fake_generate)
    dbmod._client = None
    yield
    dbmod.get_client().drop_database("evident_test")
    dbmod._client = None


@pytest.fixture
def client():
    from app.main import app

    with TestClient(app) as c:
        yield c
