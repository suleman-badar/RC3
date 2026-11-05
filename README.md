# Evident: Recruitment & Talent Intelligence Platform

Hiring decisions you can trace. Evident uses AI to match candidates to jobs, and every score points back to the resume line that earned it. Humans make every hiring decision.

**Stack:** React 18 (Vite) · FastAPI (Python) · MongoDB · Groq or Gemini (LLM) + Gemini embeddings · PyMuPDF.

```
React (client)  ──HTTPS/JSON + JWT──▶  FastAPI (server)  ──▶  MongoDB
                                         │
                                         └──▶  Groq/Gemini: structured generation; Gemini: embeddings
```

---

## 1. Run it locally (Windows / macOS / Linux)

For Docker containers, see [DOCKER.md](DOCKER.md). The default Compose setup uses
your configured MongoDB; an optional override starts a persistent local MongoDB.

For step-by-step MongoDB Atlas, Groq, and Gemini setup in this workspace, see [SETUP.md](SETUP.md).

Prerequisites:
- Python 3.10+
- Node 18+
- A MongoDB database: a MongoDB Atlas cluster with your current IP address in its Network Access list, or a local MongoDB
- A Groq API key for generation and a Gemini API key from Google AI Studio for embeddings (or set AI_PROVIDER=gemini to use Gemini for both)

### Backend
```powershell
cd server
python -m venv .venv
.venv\Scripts\activate            # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env            # only if .env does not exist; macOS/Linux: cp .env.example .env
# edit .env → MONGODB_URI, GROQ_API_KEY, GEMINI_API_KEY, JWT_SECRET
python -m scripts.check_connections --ai  # verifies MongoDB, configuration, and real generation and embedding access
python -m seed.seed --apply        # optional demo data; --reset deletes the database
uvicorn app.main:app --reload --port 8000
```
- API docs: http://localhost:8000/docs
- Health check: http://localhost:8000/api/health

### Frontend
```powershell
cd client
copy .env.example .env            # only if .env does not exist; VITE_API_URL=http://localhost:8000/api
npm install
npm run dev                       # http://localhost:5173
```

### Demo accounts
All accounts use the password `Demo@12345`.

| Role | Email |
|---|---|
| Recruiter (owns the demo job) | recruiter@evident.demo |
| Second recruiter (shows that only the job owner can record a final decision) | hr2@evident.demo |
| Candidates | aisha@evident.demo · bilal@evident.demo · sara@evident.demo |

The resume PDFs are generated into `server/seed/pdfs/`; you can use them to demo a live upload. Run `python -m seed.seed --reset` without `--apply` if you want to demo the candidates applying live.

### Tests
```powershell
cd server
pytest -q
```
The tests run offline, using an in-memory MongoDB (`mongomock`) and a deterministic fake embedder. The fake exists **only in the tests**; the application calls the selected generation provider and Gemini embeddings.

### If a model name is rejected
Run `python -m scripts.check_ai --list-models`. It lists models available to your key even when the configured model is rejected. Set `GROQ_MODEL` to a Groq JSON Schema compatible model (or `GEMINI_MODEL` when AI_PROVIDER=gemini) and `GEMINI_EMBED_MODEL` to a Gemini embedding model, then rerun `python -m scripts.check_connections --ai`.

### Tune semantic matching
After seeding, run `python -m scripts.calibrate`. It prints a similarity table for each candidate and skill. Set `SEM_THRESHOLD` in `.env` to a value between the true matches and the non-matches (default 0.72).

---

## 2. Scoring: explainable and deterministic

The score uses the problem statement's suggested weights: **skills 50% · experience 25% · project relevance 15% · qualifications 10%**.

| Component | How it's computed |
|---|---|
| Skills | Each job skill is weighted by importance (critical 3 · important 2 · nice 1; preferred skills count ×0.5). Credit per skill: **matched** = 1.0 (exact match after normalization, e.g. "Postgres" → PostgreSQL; the skill named anywhere in verified resume text, e.g. "docker-compose" → Docker; or implied by another skill, e.g. DRF → Django); **semantic** = 0.7 (Gemini embedding cosine ≥ `SEM_THRESHOLD` against a verified resume chunk); **missing evidence** = 0; **confirmed absent** = 0 (only a recruiter can set this). |
| Experience | `min(1, years / required_years)` |
| Projects | Share of required skills that appear in the candidate's verified projects |
| Qualifications | Share of required qualifications with a semantic match in education or certifications |

Every matched or semantic skill stores the resume excerpt that supports it. The selected generation provider writes the short summary and the learning suggestions, and it only sees the evidence table: no names or contact details.

**Hallucination check:** every item the AI extracts must quote a verbatim excerpt. The excerpt is fuzzy-matched against the resume text. Items that fail are flagged "Needs review" and excluded from scoring.

**Fairness:** the scoring input is built only from skills, experience, projects, education and certifications. The *Fairness proof* button re-scores a counterfactual profile with a different name, gender, age, location and nationality, and shows Δ = 0.

## 3. Pipeline
Submitted → Parsed → AI Assessment Available → Recruiter Review → Shortlisted / Rejected → Interview → Selected / Rejected.

- Every status change goes through one function. It validates the transition, writes the audit trail, and creates a simulated in-app notification.
- Final decisions can only be recorded by the recruiter who owns the job.
- When scheduling, a conflict (same interviewer or same candidate at an overlapping time) returns 409 with details. The recruiter can choose "Schedule anyway", and the interview is then flagged.

## 4. Demo script (≈5 min)
1. **Post the job.** Log in as `recruiter@`, open Jobs → New, paste a job description, click **Extract requirements with AI**, then publish.
2. **Candidate side.** Log in as `bilal@`. On the profile page, the extracted skills show normalization ("Py" → Python, "Postgres" → PostgreSQL) and resume excerpts. Apply to the job.
3. **Review.** Back as the recruiter, open the job to see the ranked list. Open Bilal: Docker shows as a **semantic match**, with the "docker-compose" excerpt as evidence. Open Sara: Django is **missing evidence**. Mark it **confirmed absent** and the score updates.
4. **Fairness.** Click **Fairness proof**; the result is Δ = 0.
5. **Shortlist Aisha.** Shortlist her, then on the Interview tab click **Generate questions**. Edit one question and regenerate another.
6. **Schedule.** Schedule an interview, then try an overlapping slot to show the conflict warning.
7. **Dashboard.** It now shows shortlisted +1, interviews +1, the shortlist rate, and the common skill gaps.
8. **Talent search.** Search "Python developers with REST API experience" and see results with evidence.

## 5. Deviations from the blueprint
- The job-description embedding is not stored. Project relevance is computed per skill instead, which is easier to explain.
- These are stretch items and are not implemented: duplicate-application detection, resume-to-job recommendations, and talent pool discovery beyond applicant search.
- DOCX upload is supported through python-docx.
