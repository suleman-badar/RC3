"""Natural-language / semantic talent search over embedded resume chunks."""
import numpy as np

from ..config import settings
from . import gemini


def search_profiles(query: str, profiles: list[dict], limit: int = 10) -> list[dict]:
    qvec = gemini.embed([query])[0]
    q = np.asarray(qvec, dtype=np.float32)
    results = []
    for prof in profiles:
        chunks = [c for c in prof.get("chunks") or [] if c.get("embedding")]
        if not chunks:
            continue
        sims = np.asarray([c["embedding"] for c in chunks], dtype=np.float32) @ q
        order = np.argsort(-sims)
        best = float(sims[order[0]])
        if best < settings.SEARCH_MIN:
            continue
        evidence = [{"text": chunks[i].get("evidence") or chunks[i]["text"], "kind": chunks[i]["kind"],
                     "similarity": round(float(sims[i]), 3)} for i in order[:3]]
        results.append({"profile": prof, "relevance": round(best, 3), "evidence": evidence})
    results.sort(key=lambda r: r["relevance"], reverse=True)
    return results[:limit]
