# Evident: manual testing and presentation guide

This guide uses fictional data from `python -m seed.presentation --apply`. The seed is additive: it never resets the database, changes existing passwords, or rewinds completed demo applications. It leaves a fresh candidate for your live demonstration.

## Accounts and assets

All newly created demo accounts use **`Demo@12345`**. These credentials apply to this fictional demo pack only.

| Account | Purpose |
|---|---|
| `demo.lead@evident.demo` | Main recruiter; owns Backend, Frontend, Data Analyst, and Full Stack demo jobs |
| `demo.reviewer@evident.demo` | Second recruiter; owns QA and DevOps jobs; use to demonstrate final-decision ownership |
| `demo.live@evident.demo` | Rayan Demo Candidate; starts with no resume and no applications |
| `demo.ayesha@evident.demo` | Experienced backend candidate; starts shortlisted |
| `demo.hamza@evident.demo` | Junior Python candidate with skill/experience gaps |
| `demo.fatima@evident.demo` | Experienced frontend candidate; has a scheduled interview |
| `demo.hassan@evident.demo` | Data analyst; has a scheduled interview |
| `demo.ali@evident.demo` | DevOps candidate; has a scheduled interview |

Other candidates: `demo.usman`, `demo.maryam`, `demo.noor`, `demo.danish`, `demo.zoya`, `demo.sana`, and `demo.omar`, all at `@evident.demo`.

Resume files: `output/pdf/demo-resumes/`. Use **`live_resume.pdf`** for the live candidate. Each file is a one-page, text-based fictional resume. The complete seed inventory and job links are recorded in `DEMO_SEED_REPORT.json` after a successful run.

## Before rehearsing

1. Start the backend in one PowerShell terminal:

   ```powershell
   cd D:\WEB\RC3\server
   .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
   ```

2. Start the frontend in another:

   ```powershell
   cd D:\WEB\RC3\client
   npm.cmd run dev
   ```

3. Open the Vite URL, normally `http://localhost:5173`. Keep the backend terminal visible for troubleshooting.
4. In `server`, run `.\.venv\Scripts\python.exe -m scripts.check_connections --ai`. Expect MongoDB, Groq generation, and Gemini embeddings to pass. A health response with `ai_configured: true` alone does not verify provider access.
5. Use a **normal browser window for the recruiter** and a **private/incognito window for the candidate**. Two ordinary tabs share the login token, so logging into another account in one tab can switch the other tab too.
6. Set browser zoom to 100%, ensure the date/time is correct, and pick interview slots at least one day in the future. The UI shows your browser's local time; use Pakistan time for this presentation.
7. Record the dashboard baseline: application count, pending reviews, current shortlisted count, upcoming interviews, and shortlist rate. Counts include existing records as well as seeded data.

## Full happy path (20-30 minutes for rehearsal)

| Step | Action | Expected result / what to explain |
|---|---|---|
| 1. Recruiter login | Sign in as `demo.lead@evident.demo`. Open Dashboard and Jobs. | Six additional demo jobs are visible; dashboards contain applications at several stages. These are fictional records. |
| 2. Create a job | Jobs -> New job. Use a unique title such as `Live Demo - Backend Engineer - Run 1`. Paste the description below and click **Extract requirements with AI**. | Required skills, preferred skills, experience, and qualifications populate. Inspect them before publishing: AI assists; the recruiter validates. |
| 3. Publish | Fill department Engineering, location Lahore / Remote, full time, PKR 120000-280000, then publish using the form's submit button. | New open job appears. Record its title/URL for later steps. |
| 4. Candidate login | In the private window, sign in as `demo.live@evident.demo`. Go to Profile & resume. | Initially no structured profile exists. |
| 5. Upload and parse | Upload `output/pdf/demo-resumes/live_resume.pdf`. Wait for parsing to finish. | Name/contact, Python/Django/PostgreSQL/Docker skills, experience, education, project, and evidence excerpts appear. Do not continue while parsing is failed or incomplete. |
| 6. Review profile | Check excerpts against the PDF. Change a harmless summary sentence and **Save changes**. | Saved text persists after refresh. Edited fields are candidate-provided corrections. They are not independent verification of a person's real qualifications. |
| 7. Apply | Candidate Jobs -> the new Live Demo job -> **Apply now**. | Application appears on the candidate dashboard; the button no longer allows another application to that job. The assessment is generated from the resume evidence. |
| 8. Open recruiter review | Recruiter -> new job -> open Rayan's application. | Status moves from AI Assessment Available to Recruiter Review when opened. Assessment shows a score, four weighted components, summary, skills, and gaps. Exact scores can vary with extraction/embedding output; check evidence and arithmetic rather than promising a fixed number. |
| 9. Inspect evidence | Click a skill on Assessment, then open **Resume evidence**. | Supporting resume excerpts appear. Explain matched, semantic, missing evidence, and confirmed absent. Missing evidence does not prove the candidate lacks the skill. |
| 10. Fairness check | Click **Fairness proof**. | Original and counterfactual scores match: delta 0 and identical breakdown. Explain this checks the implemented exclusion of changed personal attributes; it does not prove all possible hiring fairness properties. |
| 11. Private notes | **Notes & history** -> add `Presentation review: discuss API validation and deployment tradeoffs.` | Note is visible to recruiters and persists. Candidate view does not expose recruiter notes, score overrides, or internal assessment details. |
| 12. Shortlist | Click **Shortlist**, add an optional note, then Confirm. | Status becomes Shortlisted. Audit trail records actor/time; candidate receives an in-app notification. |
| 13. Questions | **Interview** tab -> **Generate questions**. Edit one question and save; regenerate one other question. | Role/project questions appear; edited question is marked Edited. Generated text should remain grounded in the candidate/job context. |
| 14. Schedule | **Schedule interview**. Choose tomorrow at 11:00 Pakistan time, duration 45, interviewer `Demo Live Interviewer`, technical type, and a demo location. | Interview appears on the application and Interview schedule. Application status becomes Interview. Candidate receives an in-app notice. Use a different future date/time if that slot is occupied. |
| 15. Ownership check | Before the final decision, sign into `demo.reviewer@evident.demo` in a separate browser profile or temporarily log out of the recruiter window. Open Rayan's application. | Reviewer can review the application but sees that only the owning recruiter can record the final decision. Sign back into `demo.lead`. |
| 16. Feedback | Simulate the interview for the demonstration. **Add feedback**: technical 4, communication 4, problem solving 4, culture fit 4, recommendation Yes. Add strengths/concerns and Save feedback. | Interview becomes completed and ratings appear. Explicitly call this simulated feedback; the current app allows feedback to be saved before the scheduled start. |
| 17. Final decision | In Interview -> Final decision, enter `Strong API implementation and clear technical reasoning demonstrated in the simulated interview.` Click **Select candidate**. | Status becomes Selected; final decision, recruiter, reason, and time are displayed. The audit history and candidate notification update. Final states cannot be moved back through the normal UI. |
| 18. Candidate confirmation | Refresh candidate dashboard and notifications. | Selected status is visible. Internal recruiter notes remain hidden. Notifications are simulated in-app; no external email/SMS/calendar invite is sent. |
| 19. Dashboard confirmation | Refresh recruiter Dashboard. | Applications rose by one for the new job. The candidate no longer counts as currently shortlisted or pending review. Shortlisted-ever includes them; the completed interview is excluded from upcoming interviews. |
| 20. Close job | Close your new Live Demo job from its recruiter job controls. | It is no longer offered as an open job to other candidates. Its existing application/history remain accessible. |

Job description to paste:

> We are hiring a Backend Engineer with at least 3 years of professional experience. Python and Django are essential. PostgreSQL and Docker are required. Candidates must have a BS Computer Science degree. Git and REST API experience are preferred. Responsibilities include developing reliable APIs, validating input, writing tests, reviewing code, and documenting deployment decisions. The role is full time in Lahore with remote flexibility.

## Show richer data using the seeded jobs (5-8 minutes)

1. Open **Demo - Backend Engineer** as `demo.lead`. Compare Ayesha, Hamza, and Ali using the row checkboxes and **Compare**. Expect contrasting experience, skills, projects, and gaps. Comparison requires 2-3 applicants from the same job.
2. Filter that list by status, a required skill, and minimum score. Reset filters after demonstrating them. Explain that filtering changes the displayed list, not stored applications.
3. Open Hamza's application. Select an evidenced gap, mark it **confirmed absent**, and inspect the updated evidence/state. A missing skill already contributes zero, so confirming absence may leave the total unchanged. Remove the override to restore the original interpretation.
4. Demonstrate **Override score** with a reason, then clear the override. The effective score/ranking should reflect the override while the original assessment remains visible.
5. Open **Talent search** and search `Python developer with Django and PostgreSQL experience`, then `React TypeScript frontend developer`. Expect relevant applicants with evidence; exact similarity scores/order are not fixed. This searches opted-in applicants, not an external talent database.
6. Show **Interview schedule**: seeded Frontend, Data Analyst, and DevOps interviews appear. Dates are generated relative to the seed run, at 10:00 Pakistan time on different future days.
7. Show the second recruiter's ownership of Demo - QA Automation Engineer and Demo - DevOps Engineer. Ownership differs even though recruiters can see shared recruiting data.

## Negative and boundary checks

Use disposable demo records for actions that change data. Run these during rehearsal, rather than spending presentation time on every one.

| Check | How to test | Expected |
|---|---|---|
| Incorrect password | Login with a wrong password | Clear login error; no authenticated session |
| Duplicate registration | Register an email already in use | Request rejected; no second account |
| Role protection | Candidate visits `/r/jobs/new` | Recruiter page inaccessible; direct recruiter API calls also reject candidate credentials |
| Missing resume | Fresh candidate opens a job before uploading | Apply is disabled with a profile-upload instruction; backend rejects an attempted apply |
| Unsupported/oversized resume | Upload `.txt` or a file over 5 MB | Validation error; no successful parse falsely reported |
| Scanned/empty resume | Upload a PDF with no readable text | Clear unreadable/empty state; use a text-based PDF to recover |
| Duplicate application | Revisit a job already applied to | Already-applied state; duplicate API request returns 409 |
| Closed job | Close a disposable job, then try to apply as a fresh candidate | Job absent from open listings; stale-page/API attempt rejected |
| Salary range | Set minimum salary above maximum | Validation prevents saving |
| Invalid scheduling | Choose a past time or duration outside 15-240 minutes | Validation error; no interview created |
| Scheduling conflict | Shortlist another disposable applicant, then book the same interviewer and overlapping time as Rayan's scheduled interview | Conflict warning names the overlap; cancel or choose a new slot. Optional **Schedule anyway** creates a clearly flagged override |
| Final decision ownership | Reviewer opens lead-owned application at Interview stage | Final decision controls unavailable; API rejects a non-owner |
| Private data | Candidate checks dashboard/application after a recruiter adds a note | No private recruiter notes or assessment details exposed |
| Session logout | Log out, then refresh a protected URL | Login required; revoked token rejected |

For the conflict test, do it **before** saving interview feedback: completed or cancelled interviews do not block the same slot. A matching candidate also causes a conflict, even if the interviewer differs.

## A short presentation script (8-10 minutes)

| Time | Screen / action | Talking point |
|---|---|---|
| 0:00-1:00 | Recruiter Dashboard and Jobs | "We manage hiring from applications to final decisions using fictional demonstration data." |
| 1:00-2:30 | Candidate upload and apply, or an already rehearsed profile | "The parser extracts structured evidence; the candidate can review it." |
| 2:30-4:00 | Assessment, skill excerpt, Resume evidence | "The score combines skills 50%, experience 25%, project relevance 15%, qualifications 10%. Every match should be traceable." |
| 4:00-5:00 | Compare three seeded backend applicants | "Recruiters can compare evidence and gaps rather than rely on one unexplained number." |
| 5:00-5:45 | Fairness proof and private note | "The implemented scoring excludes these personal fields; human review remains necessary." |
| 5:45-7:15 | Shortlist, questions, scheduling | "AI supports preparation, while people choose whom to interview." |
| 7:15-8:30 | Simulated feedback and final decision | "Only the job owner records the final outcome, with an audit trail." |
| 8:30-10:00 | Candidate notice and recruiter dashboard | "Status, notifications, and pipeline metrics stay connected." |

Do one full rehearsal first. Keep an already assessed candidate open as a backup for provider latency. If a live AI call fails, identify it as a service failure and show the previously generated record; do not claim the failed operation succeeded.

## Reruns, recovery, and current limitations

- Rerun `.\.venv\Scripts\python.exe -m seed.presentation --apply` from `server` to resume an interrupted seed. Completed pack records are skipped, including later rehearsal edits. Running it again does not restore demo accounts to their original stage.
- Use a newly registered candidate and a uniquely titled job for each full rehearsal after the first. Final Selected/Rejected states are terminal. Do not run the old `seed.seed --reset` command: it deletes the configured database.
- `--inventory` prints current counts without seeding. `--assets-only` recreates the sample resume files locally. `--apply` performs real AI calls and writes fictional records; provider quotas still apply.
- Groq handles text generation; Gemini still provides semantic embeddings. Replacing generation did not remove the embedding dependency.
- If parsing fails, fix provider/network access then reparse. If assessment fails, use Retry assessment/Re-run. If the score exists but its summary is missing, inspect the explanation error and retry after fixing generation access.
- Talent search covers opted-in applicants. Notifications are in-app simulations. Interview scheduling records a time/location; it does not book a real calendar meeting.
- The seed intentionally leaves final decisions for your live demo. It does not pretend a real candidate was interviewed or hired.

## Rehearsal result log

| Run / date | Step | Expected | Actual | Pass / fail | Fix / retest |
|---|---|---|---|---|---|
| | | | | | |

Automated checks and seed verification are separate from this manual checklist. Mark a manual step passed only after you actually perform it in the UI.
