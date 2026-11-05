"""Explainable job-relevance scoring.

The score is deterministic and traceable: skills 50%, experience 25%,
project relevance 15%, qualifications 10%. Semantic similarity comes from
Gemini embeddings. The LLM only writes the narrative (see explain.py) and is
given evidence, never personal data.
"""
from ..config import settings
from ..constants import EXCLUDED_ATTRIBUTES, IMPORTANCE_WEIGHTS, PREFERRED_FACTOR, SEMANTIC_CREDIT, WEIGHTS
from ..db import now
from . import gemini
from .normalize import IMPLIES, canonical, mentions
from .parsing import unverified_claims


def scoring_view(profile: dict) -> dict:
    """Only job-related evidence. Contact details and any personal attributes are excluded here."""
    parsed = profile.get("parsed") or {}
    return {
        "skills": parsed.get("skills") or [],
        "experience": parsed.get("experience") or [],
        "projects": parsed.get("projects") or [],
        "education": parsed.get("education") or [],
        "certifications": parsed.get("certifications") or [],
        "total_years_experience": float(parsed.get("total_years_experience") or 0),
        "chunks": [c for c in (profile.get("chunks") or []) if c.get("embedding")],
    }


def _round(x: float) -> int:
    return int(x + 0.5)


def assess(job: dict, view: dict, overrides: list[dict] | None = None) -> dict:
    T = settings.SEM_THRESHOLD
    chunks = view["chunks"]
    chunk_vecs = [c["embedding"] for c in chunks]
    job_skills = [(s, True) for s in job.get("required_skills") or []] + [
        (s, False) for s in job.get("preferred_skills") or []
    ]
    quals = job.get("qualifications") or []
    queries = [f"Skill: {s['name']}" for s, _ in job_skills] + [f"Education: {q}" for q in quals]
    sims = gemini.cosine_matrix(gemini.embed(queries), chunk_vecs) if queries and chunks else None

    verified = {canonical(s["name"]).lower(): s for s in view["skills"] if s.get("verified")}
    implied: dict[str, dict] = {}
    for key, sk in list(verified.items()):
        for target in IMPLIES.get(sk["name"], []):
            implied.setdefault(target.lower(), sk)
    projects = [p for p in view["projects"] if p.get("verified")]
    project_techs: dict[str, dict] = {}
    for p in projects:
        for t in p.get("technologies") or []:
            project_techs.setdefault(canonical(t).lower(), p)
    ov = {canonical(o["skill"]).lower(): o["state"] for o in overrides or [] if o.get("state")}
    proj_idx = [j for j, c in enumerate(chunks) if c["kind"] == "project"]
    edu_idx = [j for j, c in enumerate(chunks) if c["kind"] == "education"]

    results, num, den = [], 0.0, 0.0
    for i, (s, required) in enumerate(job_skills):
        name, key = s["name"], canonical(s["name"]).lower()
        importance = s.get("importance", "important")
        w = IMPORTANCE_WEIGHTS.get(importance, 2.0) * (1.0 if required else PREFERRED_FACTOR)
        entry = {"skill": name, "required": required, "importance": importance, "state": "missing_evidence",
                 "similarity": None, "credit": 0.0, "evidence": None}
        if key in ov:
            if ov[key] == "confirmed":
                entry.update(state="matched", credit=1.0, evidence={
                    "text": "Confirmed by recruiter", "source": "recruiter", "ref_id": None, "verified": True})
            else:
                entry.update(state="confirmed_absent", credit=0.0)
        elif key in verified:
            sk = verified[key]
            entry.update(state="matched", credit=1.0, similarity=1.0, evidence={
                "text": sk.get("excerpt") or sk["name"], "source": "skill", "ref_id": sk["id"], "verified": True})
        elif key in project_techs:
            p = project_techs[key]
            entry.update(state="matched", credit=1.0, similarity=1.0, evidence={
                "text": p.get("excerpt") or p.get("description", ""), "source": "project",
                "ref_id": p["id"], "verified": True})
        elif (hit := next((c for c in chunks if c["kind"] != "skill" and mentions(c["text"], name)), None)):
            entry.update(state="matched", credit=1.0, similarity=1.0, evidence={
                "text": hit.get("evidence") or hit["text"], "source": hit["kind"], "ref_id": hit.get("ref_id"),
                "verified": True})
        elif key in implied:
            sk = implied[key]
            entry.update(state="matched", credit=1.0, similarity=1.0, evidence={
                "text": f"{sk.get('excerpt') or sk['name']} (implies {name})", "source": "skill",
                "ref_id": sk["id"], "verified": True})
        elif sims is not None and len(chunks):
            row = sims[i]
            j = int(row.argmax())
            sim = float(row[j])
            entry["similarity"] = round(sim, 3)
            if sim >= T:
                c = chunks[j]
                entry.update(state="semantic", credit=SEMANTIC_CREDIT, evidence={
                    "text": c.get("evidence") or c["text"], "source": c["kind"], "ref_id": c.get("ref_id"),
                    "verified": True})
        num += w * entry["credit"]
        den += w
        results.append(entry)

    skills_score = 100.0 * num / den if den else 0.0
    req_entries = [r for r in results if r["required"]]
    evidenced_req = sum(1 for r in req_entries if r["state"] in ("matched", "semantic"))

    # Experience
    years = view["total_years_experience"]
    req_years = float(job.get("min_experience_years") or 0)
    if req_years <= 0:
        exp_score = 100.0 if years > 0 else 60.0
    else:
        exp_score = 100.0 * min(1.0, years / max(req_years, 0.5))

    # Project relevance: share of required skills evidenced inside projects
    proj_hits = 0
    for i, (s, required) in enumerate(job_skills):
        if not required:
            continue
        key = canonical(s["name"]).lower()
        if ov.get(key) == "absent":
            continue
        in_text = any(mentions(f"{p.get('name', '')} {p.get('description', '')}", s["name"]) for p in projects)
        sem = bool(proj_idx) and sims is not None and float(sims[i][proj_idx].max()) >= T
        if key in project_techs or in_text or sem:
            proj_hits += 1
    proj_score = 100.0 * proj_hits / len(req_entries) if (projects and req_entries) else 0.0

    # Qualifications
    met = []
    for qi, q in enumerate(quals):
        idx = len(job_skills) + qi
        ok = bool(edu_idx) and sims is not None and float(sims[idx][edu_idx].max()) >= T
        met.append({"qualification": q, "met": ok})
    qual_score = 100.0 * sum(m["met"] for m in met) / len(quals) if quals else 100.0

    parts = {
        "skills": (skills_score, f"{evidenced_req}/{len(req_entries)} required skills evidenced"
                   f" ({sum(1 for r in req_entries if r['state'] == 'semantic')} via semantic match)"),
        "experience": (exp_score, f"{years:g} yrs vs {req_years:g} required"),
        "projects": (proj_score, f"{proj_hits}/{len(req_entries)} required skills used in projects"
                     if projects else "No verified projects found"),
        "qualifications": (qual_score, f"{sum(m['met'] for m in met)}/{len(quals)} qualifications met"
                           if quals else "No qualifications required"),
    }
    breakdown = {}
    total = 0.0
    for k, (score, why) in parts.items():
        weighted = score * WEIGHTS[k]
        total += weighted
        breakdown[k] = {"score": _round(score), "weight": WEIGHTS[k], "weighted": round(weighted, 2),
                        "explanation": why}
    gaps = [{"skill": r["skill"], "state": r["state"], "required": r["required"], "importance": r["importance"]}
            for r in results if r["state"] in ("missing_evidence", "confirmed_absent")]
    return {
        "score": _round(total),
        "breakdown": breakdown,
        "skills": results,
        "qualifications": met,
        "gaps": gaps,
    }


def full_assessment(job: dict, profile: dict, overrides: list[dict] | None = None,
                    previous: dict | None = None) -> dict:
    from .explain import explain

    result = assess(job, scoring_view(profile), overrides)
    result["unverified_claims"] = unverified_claims(profile.get("parsed") or {})
    result["excluded_attributes"] = EXCLUDED_ATTRIBUTES
    result["model"] = settings.generation_model
    result["generation_provider"] = settings.AI_PROVIDER
    result["embedding_model"] = settings.GEMINI_EMBED_MODEL
    result["computed_at"] = now()
    try:
        narrative = explain(job, result)
        result["summary"] = narrative["summary"]
        result["learning_suggestions"] = narrative["learning_suggestions"]
        result["explain_error"] = None
    except gemini.AIError as exc:
        result["summary"] = (previous or {}).get("summary")
        result["learning_suggestions"] = (previous or {}).get("learning_suggestions") or []
        result["explain_error"] = str(exc)
    return result
