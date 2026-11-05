"""Role- and project-specific interview question generation (Gemini)."""
import uuid

from pydantic import BaseModel

from . import gemini

LEVELS = ["beginner", "intermediate", "advanced"]


class XQuestion(BaseModel):
    difficulty: str
    category: str
    question: str
    guideline: str


class XQuestions(BaseModel):
    questions: list[XQuestion]


def _context(job: dict, profile: dict) -> str:
    parsed = profile.get("parsed") or {}
    req = ", ".join(f"{s['name']} ({s.get('importance', '')})" for s in job.get("required_skills") or [])
    pref = ", ".join(s["name"] for s in job.get("preferred_skills") or [])
    projects = "\n".join(
        f"- {p.get('name')}: {p.get('description', '')} [tech: {', '.join(p.get('technologies') or [])}]"
        for p in parsed.get("projects") or [] if p.get("verified")
    ) or "- (no verified projects)"
    skills = ", ".join(s["name"] for s in parsed.get("skills") or [] if s.get("verified"))
    return (f"Job title: {job.get('title')}\nRequired skills: {req}\nPreferred skills: {pref or '-'}\n"
            f"Job description: {job.get('description', '')[:1500]}\n"
            f"Candidate verified skills: {skills or '-'}\nCandidate projects:\n{projects}")


def _clean(q: XQuestion) -> dict:
    difficulty = q.difficulty.lower().strip()
    category = q.category.lower().strip()
    return {
        "id": f"q_{uuid.uuid4().hex[:8]}",
        "difficulty": difficulty if difficulty in LEVELS else "intermediate",
        "category": category if category in ("role", "project") else "role",
        "question": q.question.strip(),
        "guideline": q.guideline.strip(),
        "edited": False,
    }


def generate_all(job: dict, profile: dict) -> list[dict]:
    prompt = f"""Create interview questions for this candidate and role.
{_context(job, profile)}

Return exactly 9 questions: 3 beginner, 3 intermediate, 3 advanced.
- category "role": about the job's required skills.
- category "project": about one of the candidate's listed projects, naming the project. At least 3 must be project questions
  (if the candidate has no verified projects, use "role" for all).
- guideline: 1-3 sentences on what a strong answer should cover.
- difficulty must be one of: beginner, intermediate, advanced."""
    out = gemini.generate_json(prompt, XQuestions, temperature=0.7)
    questions = [_clean(q) for q in out.questions if q.question.strip()]
    if not questions:
        raise gemini.AIError("The AI returned no questions")
    order = {lvl: i for i, lvl in enumerate(LEVELS)}
    return sorted(questions, key=lambda q: order[q["difficulty"]])


def regenerate_one(job: dict, profile: dict, existing: list[dict], target: dict) -> dict:
    others = "\n".join(f"- {q['question']}" for q in existing)
    prompt = f"""Write ONE new replacement interview question.
{_context(job, profile)}

Difficulty: {target['difficulty']}. Category: {target['category']}.
It must be different from all of these existing questions:
{others}
Return JSON with a "questions" list containing exactly one item (difficulty, category, question, guideline)."""
    out = gemini.generate_json(prompt, XQuestions, temperature=0.9)
    if not out.questions:
        raise gemini.AIError("The AI returned no question")
    q = _clean(out.questions[0])
    q["difficulty"], q["category"] = target["difficulty"], target["category"]
    return q
