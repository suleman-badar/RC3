"""Build embedding chunks from the job-relevant (non-PII) parts of a parsed resume."""
from . import gemini


def build_chunks(parsed: dict) -> list[dict]:
    chunks = []
    for s in parsed.get("skills") or []:
        if not s.get("verified"):
            continue  # unsupported claims never become evidence
        text = f"Skill: {s['name']}"
        if s.get("excerpt"):
            text += f" — {s['excerpt']}"
        chunks.append({"id": f"k_{s['id']}", "kind": "skill", "ref_id": s["id"], "text": text,
                       "evidence": s.get("excerpt") or s["name"]})
    for e in parsed.get("experience") or []:
        if not e.get("verified"):
            continue
        text = f"{e.get('title', '')} at {e.get('company', '')}: {e.get('description', '')}".strip()
        chunks.append({"id": f"k_{e['id']}", "kind": "experience", "ref_id": e["id"], "text": text,
                       "evidence": e.get("description") or e.get("excerpt", "")})
    for p in parsed.get("projects") or []:
        if not p.get("verified"):
            continue
        techs = ", ".join(p.get("technologies") or [])
        text = f"Project {p.get('name', '')}: {p.get('description', '')} Technologies: {techs}".strip()
        chunks.append({"id": f"k_{p['id']}", "kind": "project", "ref_id": p["id"], "text": text,
                       "evidence": p.get("description") or p.get("excerpt", "")})
    for ed in parsed.get("education") or []:
        if not ed.get("verified"):
            continue
        text = f"Education: {ed.get('degree', '')}, {ed.get('institution', '')} {ed.get('year', '')}".strip()
        chunks.append({"id": f"k_{ed['id']}", "kind": "education", "ref_id": ed["id"], "text": text,
                       "evidence": ed.get("excerpt") or text})
    for c in parsed.get("certifications") or []:
        if not c.get("verified"):
            continue
        chunks.append({"id": f"k_{c['id']}", "kind": "education", "ref_id": c["id"],
                       "text": f"Certification: {c.get('name', '')}", "evidence": c.get("excerpt", "")})
    return chunks


def embed_chunks(parsed: dict) -> list[dict]:
    chunks = build_chunks(parsed)
    if not chunks:
        return []
    vectors = gemini.embed([c["text"] for c in chunks])
    for c, v in zip(chunks, vectors):
        c["embedding"] = v
    return chunks
