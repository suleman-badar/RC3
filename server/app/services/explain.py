"""Grounded natural-language explanation of an assessment (no personal data is sent)."""
from pydantic import BaseModel

from . import gemini


class Suggestion(BaseModel):
    skill: str
    suggestion: str


class ExplainOut(BaseModel):
    summary: str
    learning_suggestions: list[Suggestion]


PROMPT = """You are an assistant helping a recruiter understand a candidate's fit for a job.
Use ONLY the evidence listed below. Do not add facts. Do not mention names or personal characteristics.
The final hiring decision belongs to the recruiter: describe evidence, do not decide.

Job: {title}
Required experience: {years} years
Overall score: {score}/100
Score breakdown: {breakdown}

Skill evidence (state: matched = exact evidence, semantic = similar evidence, missing_evidence = no evidence found
in the resume (NOT the same as lacking the skill), confirmed_absent = a human confirmed the skill is absent):
{evidence}

Return JSON:
- summary: at most 80 words explaining the score, referencing the evidence, and clearly separating
  missing evidence from confirmed absence.
- learning_suggestions: one concrete, practical learning suggestion for EACH skill in this list: {gaps}
  (empty list if none)."""


def explain(job: dict, assessment: dict) -> dict:
    lines = []
    for s in assessment["skills"]:
        ev = (s.get("evidence") or {}).get("text") or "-"
        sim = f" (similarity {s['similarity']:.2f})" if s.get("similarity") is not None else ""
        lines.append(f"- {s['skill']} [{'required' if s['required'] else 'preferred'}]: {s['state']}{sim}; "
                     f"evidence: \"{ev[:200]}\"")
    breakdown = ", ".join(f"{k} {v['score']}/100 ({v['explanation']})" for k, v in assessment["breakdown"].items())
    gaps = ", ".join(g["skill"] for g in assessment["gaps"]) or "none"
    out = gemini.generate_json(
        PROMPT.format(title=job.get("title"), years=job.get("min_experience_years", 0),
                      score=assessment["score"], breakdown=breakdown, evidence="\n".join(lines), gaps=gaps),
        ExplainOut,
        temperature=0.3,
    )
    return {"summary": out.summary, "learning_suggestions": [s.model_dump() for s in out.learning_suggestions]}
