import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle, ArrowLeft, CalendarPlus, CircleSlash, Check, Gavel, Lightbulb, MessageSquarePlus, Pencil,
  RefreshCw, Scale, ShieldCheck, Sparkles, Trash2, Undo2,
} from "lucide-react";
import { api, errorMessage } from "../../api/client";
import { appKeys, useApiMutation, useApplication } from "../../api/queries";
import {
  AuditTimeline, Button, Card, EmptyState, ErrorState, EvidenceQuote, Input, InterviewStatusBadge, Modal, PageSkeleton, ScoreBreakdown,
  ScoreRing, Select, SkillChip, SkillLegend, StatusBadge, Tabs, Textarea, VerifiedMark,
} from "../../components/ui";
import { ACTION_LABELS, INTERVIEW_TYPES, RECOMMENDATIONS, SKILL_STATES, formatDate } from "../../lib/status";

export default function ApplicationDetail() {
  const { id } = useParams();
  const app = useApplication(id);
  const [tab, setTab] = useState("assessment");

  if (app.isLoading) return <PageSkeleton />;
  if (app.isError) return <div className="page"><ErrorState message={errorMessage(app.error, "Application not found")} onRetry={app.refetch} /></div>;
  const a = app.data;

  return (
    <div className="page">
      <Link to={`/r/jobs/${a.job.id}`} className="row small"><ArrowLeft size={14} /> {a.job.title} applicants</Link>
      <Header a={a} />
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: "assessment", label: "Assessment" },
        { id: "resume", label: "Resume evidence" },
        { id: "interview", label: `Interview${a.questions?.length ? ` (${a.questions.length} Qs)` : ""}` },
        { id: "notes", label: `Notes & history${a.notes?.length ? ` (${a.notes.length})` : ""}` },
      ]} />
      {tab === "assessment" && <AssessmentTab a={a} />}
      {tab === "resume" && <ResumeTab a={a} />}
      {tab === "interview" && <InterviewTab a={a} />}
      {tab === "notes" && <NotesTab a={a} />}
    </div>
  );
}

/* ---------------- Header & status actions ---------------- */
function Header({ a }) {
  const [pending, setPending] = useState(null);
  const [note, setNote] = useState("");
  const change = useApiMutation(
    ({ status, note: n }) => api.patch(`/applications/${a.id}/status`, { status, note: n || null }).then((r) => r.data),
    { invalidate: appKeys(a.id), success: (d) => `Status updated: ${d.status_label}`, onSuccess: () => { setPending(null); setNote(""); } }
  );
  const actions = a.allowed_transitions.filter((s) => !(a.status === "interview" && (s === "selected" || s === "rejected")));
  return (
    <div className="page-header">
      <div className="stack" style={{ gap: 6 }}>
        <div className="row wrap"><h1>{a.candidate.name}</h1><StatusBadge status={a.status} /></div>
        <span className="muted">{a.candidate.email} · applied {formatDate(a.submitted_at, true)} for {a.job.title}</span>
      </div>
      <div className="row wrap">
        {actions.map((s) => (
          <Button key={s} variant={s === "rejected" ? "danger" : s === "shortlisted" ? "primary" : "secondary"}
            onClick={() => setPending(s)}>{ACTION_LABELS[s]}</Button>
        ))}
        {a.status === "interview" && !a.job.is_owner && <span className="small muted">Final decision: job owner only</span>}
      </div>
      <Modal open={!!pending} title={`${ACTION_LABELS[pending] || ""} ${a.candidate.name}?`} onClose={() => setPending(null)}
        footer={<>
          <Button variant="secondary" onClick={() => setPending(null)}>Cancel</Button>
          <Button variant={pending === "rejected" ? "danger" : "primary"} loading={change.isPending}
            onClick={() => change.mutate({ status: pending, note })}>Confirm</Button>
        </>}>
        <p className="muted">This is recorded in the audit trail{pending !== "recruiter_review" ? " and the candidate is notified (simulated)" : ""}.</p>
        <Textarea label="Note for the audit trail (optional)" style={{ minHeight: 80 }} value={note} onChange={(e) => setNote(e.target.value)} />
      </Modal>
    </div>
  );
}

/* ---------------- Assessment ---------------- */
function AssessmentTab({ a }) {
  const asm = a.assessment;
  const [active, setActive] = useState(null);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [fairness, setFairness] = useState(null);
  const reassess = useApiMutation(() => api.post(`/applications/${a.id}/reassess`).then((r) => r.data), {
    invalidate: appKeys(a.id), success: "Assessment refreshed",
  });
  const overrideSkill = useApiMutation(
    ({ skill, state }) => api.put(`/applications/${a.id}/skill-overrides`, { overrides: [{ skill, state }] }).then((r) => r.data),
    { invalidate: appKeys(a.id), success: (d, v) => (v.state ? `${v.skill} marked ${v.state === "absent" ? "confirmed absent" : "confirmed"} — score recalculated` : `${v.skill} override removed`) }
  );
  const fair = useApiMutation(() => api.post(`/applications/${a.id}/fairness-check`).then((r) => r.data), {
    onSuccess: (d) => setFairness(d),
  });

  if (a.assessment_status === "pending") {
    return <Card><EmptyState icon={Sparkles} title="AI assessment running…" text="Comparing resume evidence with the job requirements." /></Card>;
  }
  if (!asm) {
    return (
      <Card className="stack">
        <ErrorState message={`AI assessment is not available: ${a.assessment_error || "unknown error"}`} />
        <Button onClick={() => reassess.mutate()} loading={reassess.isPending}><RefreshCw size={16} /> Retry assessment</Button>
      </Card>
    );
  }
  const overrides = Object.fromEntries((a.skill_overrides || []).map((o) => [o.skill.toLowerCase(), o.state]));
  const activeSkill = asm.skills.find((s) => s.skill === active) || null;

  return (
    <div className="stack-lg">
      {a.assessment_status === "failed" && <ErrorState message={`Last re-assessment failed: ${a.assessment_error}`} onRetry={() => reassess.mutate()} />}
      <div className="grid grid-assess" style={{ alignItems: "start" }}>
        <Card className="stack" style={{ alignItems: "stretch" }}>
          <div className="row" style={{ gap: 16 }}>
            <ScoreRing value={a.effective_score} size={110} label="Job-relevance score" />
            <div className="stack" style={{ gap: 4 }}>
              <span className="label">Job-relevance</span>
              {a.override ? (
                <>
                  <span className="badge badge-primary">Overridden by {a.override.by_name}</span>
                  <span className="small muted">AI score {asm.score} · “{a.override.reason}”</span>
                </>
              ) : <span className="small muted">Weighted, evidence-based. Not a decision.</span>}
            </div>
          </div>
          <ScoreBreakdown breakdown={asm.breakdown} />
          <div className="row wrap">
            <Button variant="secondary" size="sm" onClick={() => setOverrideOpen(true)}><Pencil size={14} /> {a.override ? "Change override" : "Override score"}</Button>
            <Button variant="secondary" size="sm" loading={reassess.isPending} onClick={() => reassess.mutate()}><RefreshCw size={14} /> Re-run</Button>
            <Button variant="secondary" size="sm" loading={fair.isPending} onClick={() => fair.mutate()}><Scale size={14} /> Fairness proof</Button>
          </div>
        </Card>

        <div className="stack">
          <Card className="stack">
            <div className="row between wrap"><h2>Why this score</h2><span className="small muted">AI summary grounded on the evidence below</span></div>
            {asm.summary ? <p>{asm.summary}</p> : (
              <div className="alert alert-warn"><span className="grow">Narrative explanation unavailable{asm.explain_error ? `: ${asm.explain_error}` : ""}. The numeric score and evidence below are still valid.</span>
                <Button variant="secondary" size="sm" onClick={() => reassess.mutate()} loading={reassess.isPending}>Retry</Button></div>
            )}
          </Card>
          <Card className="stack">
            <div className="row between wrap"><h2>Skill evidence</h2><SkillLegend /></div>
            <p className="small muted">Click a skill to see its evidence. “Missing evidence” means the resume doesn't show it — only a human can confirm absence.</p>
            <div className="row wrap">
              {asm.skills.map((s) => (
                <SkillChip key={s.skill} name={s.skill} state={s.state} similarity={s.similarity} required={s.required}
                  pressed={active === s.skill} onClick={() => setActive(active === s.skill ? null : s.skill)} />
              ))}
            </div>
            {activeSkill && (
              <div className="stack" style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
                <div className="row between wrap">
                  <strong>{activeSkill.skill} · {SKILL_STATES[activeSkill.state].label}</strong>
                  <span className="small muted">
                    {activeSkill.required ? "Required" : "Preferred"} · {activeSkill.importance}
                    {activeSkill.similarity != null && ` · best similarity ${activeSkill.similarity.toFixed(2)}`}
                  </span>
                </div>
                {activeSkill.evidence ? <EvidenceQuote text={activeSkill.evidence.text} source={activeSkill.evidence.source} />
                  : <p className="muted small">{SKILL_STATES[activeSkill.state].help}.</p>}
                <div className="row wrap">
                  {overrides[activeSkill.skill.toLowerCase()] ? (
                    <Button variant="secondary" size="sm" loading={overrideSkill.isPending} onClick={() => overrideSkill.mutate({ skill: activeSkill.skill, state: null })}><Undo2 size={14} /> Remove correction</Button>
                  ) : (
                    <>
                      {activeSkill.state !== "matched" && <Button variant="secondary" size="sm" loading={overrideSkill.isPending} onClick={() => overrideSkill.mutate({ skill: activeSkill.skill, state: "confirmed" })}><Check size={14} /> Confirm has skill</Button>}
                      <Button variant="secondary" size="sm" loading={overrideSkill.isPending} onClick={() => overrideSkill.mutate({ skill: activeSkill.skill, state: "absent" })}><CircleSlash size={14} /> Mark confirmed absent</Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <Card className="stack">
          <h2 className="row"><Lightbulb size={18} /> Gaps & learning areas</h2>
          {asm.gaps.length === 0 && <p className="muted">No skill gaps — every listed skill has evidence.</p>}
          {asm.gaps.map((g) => {
            const sug = asm.learning_suggestions?.find((l) => l.skill.toLowerCase() === g.skill.toLowerCase());
            return (
              <div key={g.skill} className="stack" style={{ gap: 4 }}>
                <div className="row"><SkillChip name={g.skill} state={g.state} required={g.required} /><span className="small muted">{SKILL_STATES[g.state].label}</span></div>
                {sug && <p className="small">{sug.suggestion}</p>}
              </div>
            );
          })}
          {asm.qualifications?.length > 0 && <>
            <span className="label">Qualifications</span>
            {asm.qualifications.map((q) => (
              <div key={q.qualification} className="row small">{q.met ? <Check size={14} color="#15803d" /> : <AlertTriangle size={14} color="#b45309" />}{q.qualification} — {q.met ? "evidence found" : "no evidence found"}</div>
            ))}
          </>}
        </Card>
        <Card className="stack">
          <h2 className="row"><ShieldCheck size={18} /> Verification & fairness</h2>
          {asm.unverified_claims?.length ? (
            <>
              <p className="small">These AI-extracted claims could not be matched to the resume text. They are excluded from scoring until reviewed.</p>
              {asm.unverified_claims.map((c, i) => (
                <div key={i} className="stack" style={{ gap: 4 }}>
                  <span className="small"><strong>{c.item}</strong> <span className="muted">({c.section})</span></span>
                  <EvidenceQuote text={c.excerpt || "(no excerpt provided)"} unverified />
                </div>
              ))}
            </>
          ) : <div className="alert alert-ok"><Check size={16} /> Every extracted claim is linked to a verbatim resume excerpt.</div>}
          <span className="label">Excluded from scoring</span>
          <div className="row wrap">{asm.excluded_attributes?.map((x) => <span key={x} className="badge badge-neutral">{x.replace("_", " ")}</span>)}</div>
          <span className="small muted">Model: {asm.model} · computed {formatDate(asm.computed_at, true)}</span>
        </Card>
      </div>

      <OverrideModal a={a} open={overrideOpen} onClose={() => setOverrideOpen(false)} />
      <Modal open={!!fairness} title="Fairness proof" onClose={() => setFairness(null)}
        footer={<Button onClick={() => setFairness(null)}>Close</Button>}>
        {fairness && <>
          <div className={`alert ${fairness.delta === 0 ? "alert-ok" : "alert-error"}`}>
            {fairness.delta === 0 ? <Check size={18} /> : <AlertTriangle size={18} />}
            <div className="stack" style={{ gap: 2 }}>
              <strong>Δ score = {fairness.delta}</strong>
              <span className="small">Original {fairness.original_score} → counterfactual {fairness.counterfactual_score}. {fairness.breakdown_identical ? "Every component is identical." : "Components differ."}</span>
            </div>
          </div>
          <p className="small">We re-scored this application after changing personal attributes that must not matter:</p>
          <table className="table"><tbody>
            {Object.entries(fairness.changed_attributes).map(([k, v]) => <tr key={k}><td className="muted">{k.replace("_", " ")}</td><td>{String(v)}</td></tr>)}
          </tbody></table>
          <p className="small muted">The scoring engine only reads skills, experience, projects, education and certifications.</p>
        </>}
      </Modal>
    </div>
  );
}

function OverrideModal({ a, open, onClose }) {
  const [score, setScore] = useState(a.override?.score ?? a.assessment?.score ?? 0);
  const [reason, setReason] = useState(a.override?.reason || "");
  const [err, setErr] = useState("");
  const save = useApiMutation((body) => api.put(`/applications/${a.id}/override`, body).then((r) => r.data), {
    invalidate: appKeys(a.id), success: "Score override saved", onSuccess: onClose,
  });
  const submit = () => {
    const n = Number(score);
    if (Number.isNaN(n) || n < 0 || n > 100) return setErr("Score must be 0–100");
    if (reason.trim().length < 5) return setErr("Give a reason (at least 5 characters)");
    setErr("");
    save.mutate({ score: Math.round(n), reason });
  };
  return (
    <Modal open={open} title="Override score" onClose={onClose}
      footer={<>
        {a.override && <Button variant="ghost" onClick={() => save.mutate({ clear: true })}>Remove override</Button>}
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} loading={save.isPending}>Save override</Button>
      </>}>
      <p className="small muted">The AI score ({a.assessment?.score}) is kept and shown alongside your override.</p>
      <Input label="New score (0–100)" type="number" min={0} max={100} value={score} onChange={(e) => setScore(e.target.value)} />
      <Textarea label="Reason" style={{ minHeight: 80 }} value={reason} onChange={(e) => setReason(e.target.value)} error={err} />
    </Modal>
  );
}

/* ---------------- Resume evidence ---------------- */
function ResumeTab({ a }) {
  const p = a.profile?.parsed;
  if (!p) return <Card><EmptyState title="No parsed resume" /></Card>;
  const Section = ({ title, items, render }) => (
    <Card className="stack">
      <h2>{title}</h2>
      {(!items || items.length === 0) && <p className="muted small">Nothing listed in the resume.</p>}
      {items?.map((it) => (
        <div key={it.id} className="stack" style={{ gap: 6 }}>
          <div className="row between wrap">{render(it)}<span className="row">{it.source === "candidate" && <span className="badge badge-neutral">Edited by candidate</span>}<VerifiedMark verified={it.verified} /></span></div>
          {it.excerpt && <EvidenceQuote text={it.excerpt} unverified={!it.verified} />}
        </div>
      ))}
    </Card>
  );
  return (
    <div className="stack-lg">
      <Card className="stack">
        <h2>Extracted skills</h2>
        <p className="small muted">Normalized names; original wording in brackets. {p.total_years_experience} years total experience.</p>
        <div className="row wrap">
          {p.skills.map((s) => (
            <span key={s.id} className="chip" title={s.excerpt}>{s.name}{s.raw && s.raw.toLowerCase() !== s.name.toLowerCase() && <span className="small muted">({s.raw})</span>}{!s.verified && <AlertTriangle size={12} color="#b91c1c" />}</span>
          ))}
        </div>
      </Card>
      <Section title="Experience" items={p.experience} render={(e) => <div><strong>{e.title}</strong> · {e.company} <span className="small muted">{e.start} – {e.end} · {e.years} yrs</span><p className="small">{e.description}</p></div>} />
      <Section title="Projects" items={p.projects} render={(pr) => <div><strong>{pr.name}</strong> <span className="small muted">{(pr.technologies || []).join(", ")}</span><p className="small">{pr.description}</p></div>} />
      <Section title="Education" items={p.education} render={(ed) => <div><strong>{ed.degree}</strong> · {ed.institution} <span className="small muted">{ed.year}</span></div>} />
      {p.certifications?.length > 0 && <Section title="Certifications" items={p.certifications} render={(c) => <strong>{c.name}</strong>} />}
    </div>
  );
}

/* ---------------- Interview: questions, scheduling, feedback, decision ---------------- */
const LEVELS = ["beginner", "intermediate", "advanced"];

function InterviewTab({ a }) {
  const [editing, setEditing] = useState(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [feedbackFor, setFeedbackFor] = useState(null);
  const [regenId, setRegenId] = useState(null);
  const gen = useApiMutation((body) => api.post(`/applications/${a.id}/questions/generate`, body).then((r) => r.data), {
    invalidate: [["application", a.id]],
    success: (_, v) => (v.question_id ? "Question regenerated" : "Interview questions generated"),
    onSuccess: () => setRegenId(null), onError: () => setRegenId(null),
  });
  const del = useApiMutation((qid) => api.delete(`/applications/${a.id}/questions/${qid}`), {
    invalidate: [["application", a.id]], success: "Question removed",
  });
  const canSchedule = ["shortlisted", "interview"].includes(a.status);

  return (
    <div className="stack-lg">
      <Card className="stack">
        <div className="row between wrap">
          <div className="stack" style={{ gap: 2 }}>
            <h2>Interview questions</h2>
            <span className="small muted">Role-specific and project-specific, with answer guidelines.</span>
          </div>
          <Button variant={a.questions?.length ? "secondary" : "primary"} loading={gen.isPending && !regenId} onClick={() => gen.mutate({})}>
            <Sparkles size={16} /> {a.questions?.length ? "Regenerate all" : "Generate questions"}
          </Button>
        </div>
        {!a.questions?.length && !gen.isPending && <EmptyState icon={MessageSquarePlus} title="No questions yet" text="Generate a tailored set from the job and this candidate's projects." />}
        {LEVELS.map((lvl) => {
          const qs = (a.questions || []).filter((q) => q.difficulty === lvl);
          if (!qs.length) return null;
          return (
            <div key={lvl} className="stack">
              <span className="label">{lvl}</span>
              {qs.map((q) => (
                <div key={q.id} className="card card-tight stack" style={{ gap: 6, boxShadow: "none" }}>
                  <div className="row between" style={{ alignItems: "flex-start" }}>
                    <div className="stack grow" style={{ gap: 4 }}>
                      <div className="row wrap">
                        <span className={`badge ${q.category === "project" ? "badge-semantic" : "badge-primary"}`}>{q.category === "project" ? "Project" : "Role"}</span>
                        {q.edited && <span className="badge badge-neutral">Edited</span>}
                      </div>
                      <strong>{q.question}</strong>
                      {q.guideline && <span className="small muted"><strong>Look for:</strong> {q.guideline}</span>}
                    </div>
                    <div className="row" style={{ flex: "none" }}>
                      <button className="btn btn-ghost btn-icon" aria-label="Edit question" onClick={() => setEditing(q)}><Pencil size={15} /></button>
                      <button className="btn btn-ghost btn-icon" aria-label="Regenerate question" disabled={gen.isPending}
                        onClick={() => { setRegenId(q.id); gen.mutate({ question_id: q.id }); }}>
                        {regenId === q.id ? <span className="spinner" /> : <RefreshCw size={15} />}
                      </button>
                      <button className="btn btn-ghost btn-icon" aria-label="Delete question" onClick={() => del.mutate(q.id)}><Trash2 size={15} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </Card>

      <Card className="stack">
        <div className="row between wrap">
          <h2>Interviews</h2>
          <Button disabled={!canSchedule} onClick={() => setScheduleOpen(true)} title={canSchedule ? "" : "Shortlist the candidate first"}>
            <CalendarPlus size={16} /> Schedule interview
          </Button>
        </div>
        {!canSchedule && a.interviews.length === 0 && <p className="small muted">Shortlist this candidate to schedule an interview.</p>}
        {a.interviews.map((iv) => (
          <div key={iv.id} className="card card-tight stack" style={{ boxShadow: "none", gap: 6 }}>
            <div className="row between wrap">
              <div className="stack" style={{ gap: 2 }}>
                <strong>{formatDate(iv.start, true)} · {iv.duration_min} min · {INTERVIEW_TYPES[iv.type]}</strong>
                <span className="small muted">Interviewer: {iv.interviewer_name}{iv.location_or_link ? ` · ${iv.location_or_link}` : ""}</span>
              </div>
              <div className="row">
                {iv.conflict_overridden && <span className="badge badge-missing"><AlertTriangle size={11} /> Scheduled despite conflict</span>}
                <InterviewStatusBadge status={iv.status} />
                {iv.status !== "cancelled" && <Button variant="secondary" size="sm" onClick={() => setFeedbackFor(iv)}>{iv.feedback ? "Edit feedback" : "Add feedback"}</Button>}
              </div>
            </div>
            {iv.feedback && (
              <div className="row wrap small">
                {["technical", "communication", "problem_solving", "culture_fit"].map((k) => <span key={k} className="badge badge-neutral">{k.replace("_", " ")}: {iv.feedback[k]}/5</span>)}
                <span className="badge badge-primary">Recommendation: {RECOMMENDATIONS[iv.feedback.recommendation]}</span>
                {iv.feedback.strengths && <span><strong>Strengths:</strong> {iv.feedback.strengths}</span>}
                {iv.feedback.concerns && <span><strong>Concerns:</strong> {iv.feedback.concerns}</span>}
              </div>
            )}
          </div>
        ))}
      </Card>

      <DecisionPanel a={a} />
      <QuestionModal a={a} q={editing} onClose={() => setEditing(null)} />
      <ScheduleModal a={a} open={scheduleOpen} onClose={() => setScheduleOpen(false)} />
      <FeedbackModal a={a} iv={feedbackFor} onClose={() => setFeedbackFor(null)} />
    </div>
  );
}

function DecisionPanel({ a }) {
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const decide = useApiMutation((outcome) => api.post(`/applications/${a.id}/decision`, { outcome, reason }).then((r) => r.data), {
    invalidate: appKeys(a.id), success: (d) => `Final decision recorded: ${d.status_label}`,
  });
  if (a.decision) {
    return (
      <Card className="stack">
        <h2 className="row"><Gavel size={18} /> Final decision</h2>
        <div className={`alert ${a.decision.outcome === "selected" ? "alert-ok" : "alert-error"}`}>
          <span><strong>{a.decision.outcome === "selected" ? "Selected" : "Rejected"}</strong> by {a.decision.by_name} on {formatDate(a.decision.at, true)}{a.decision.reason ? ` — “${a.decision.reason}”` : ""}</span>
        </div>
      </Card>
    );
  }
  if (a.status !== "interview") return null;
  const go = (outcome) => {
    if (reason.trim().length < 3) return setErr("Add a short reason for the record");
    setErr("");
    decide.mutate(outcome);
  };
  return (
    <Card className="stack">
      <h2 className="row"><Gavel size={18} /> Final decision</h2>
      {!a.job.is_owner ? <p className="muted">Only the recruiter who owns this job can record the final decision.</p> : <>
        <p className="small muted">Recorded in the audit trail; the candidate receives a (simulated) notification.</p>
        <Textarea label="Reason" style={{ minHeight: 70 }} value={reason} error={err} onChange={(e) => setReason(e.target.value)} />
        <div className="row">
          <Button loading={decide.isPending && decide.variables === "selected"} onClick={() => go("selected")}><Check size={16} /> Select candidate</Button>
          <Button variant="danger" loading={decide.isPending && decide.variables === "rejected"} onClick={() => go("rejected")}>Reject</Button>
        </div>
      </>}
    </Card>
  );
}

function QuestionModal({ a, q, onClose }) {
  const [form, setForm] = useState(null);
  if (q && (!form || form.id !== q.id)) setForm({ ...q });
  const save = useApiMutation((f) => api.put(`/applications/${a.id}/questions/${f.id}`, {
    question: f.question, guideline: f.guideline, difficulty: f.difficulty,
  }).then((r) => r.data), { invalidate: [["application", a.id]], success: "Question updated", onSuccess: () => { setForm(null); onClose(); } });
  if (!q || !form) return null;
  return (
    <Modal open title="Edit question" onClose={() => { setForm(null); onClose(); }}
      footer={<><Button variant="secondary" onClick={() => { setForm(null); onClose(); }}>Cancel</Button>
        <Button loading={save.isPending} disabled={form.question.trim().length < 5} onClick={() => save.mutate(form)}>Save</Button></>}>
      <Select label="Difficulty" value={form.difficulty} options={{ beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" }}
        onChange={(e) => setForm({ ...form, difficulty: e.target.value })} />
      <Textarea label="Question" style={{ minHeight: 80 }} value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })}
        error={form.question.trim().length < 5 ? "At least 5 characters" : ""} />
      <Textarea label="Answer guideline" style={{ minHeight: 80 }} value={form.guideline} onChange={(e) => setForm({ ...form, guideline: e.target.value })} />
    </Modal>
  );
}

function tomorrow() {
  const d = new Date(Date.now() + 86400000);
  return d.toISOString().slice(0, 10);
}

function ScheduleModal({ a, open, onClose }) {
  const [form, setForm] = useState({ date: tomorrow(), time: "10:00", duration_min: 60, interviewer_name: "", interviewer_email: "", type: "technical", location_or_link: "" });
  const [errors, setErrors] = useState({});
  const [conflicts, setConflicts] = useState(null);
  const schedule = useApiMutation((body) => api.post("/interviews", body).then((r) => r.data), {
    invalidate: appKeys(a.id),
    success: "Interview scheduled — candidate notified",
    silentError: true,
    onSuccess: () => { setConflicts(null); onClose(); },
    onError: (err) => {
      if (err.response?.status === 409 && err.response.data?.detail?.conflicts) setConflicts(err.response.data.detail.conflicts);
      else setErrors({ form: errorMessage(err) });
    },
  });
  const submit = (force = false) => {
    const e = {};
    const start = new Date(`${form.date}T${form.time}`);
    if (Number.isNaN(start.getTime())) e.date = "Pick a valid date and time";
    else if (start <= new Date()) e.date = "Must be in the future";
    if (form.interviewer_name.trim().length < 2) e.interviewer_name = "Enter the interviewer's name";
    const dur = Number(form.duration_min);
    if (!(dur >= 15 && dur <= 240)) e.duration_min = "15–240 minutes";
    if (form.interviewer_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.interviewer_email)) e.interviewer_email = "Invalid email";
    setErrors(e);
    if (Object.keys(e).length) return;
    schedule.mutate({
      application_id: a.id, start: start.toISOString(), duration_min: dur, interviewer_name: form.interviewer_name,
      interviewer_email: form.interviewer_email || null, type: form.type, location_or_link: form.location_or_link || null, force,
    });
  };
  const set = (k, v) => { setForm({ ...form, [k]: v }); setConflicts(null); };
  return (
    <Modal open={open} title={`Schedule interview · ${a.candidate.name}`} onClose={onClose}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        {conflicts ? <Button variant="danger" loading={schedule.isPending} onClick={() => submit(true)}>Schedule anyway</Button>
          : <Button loading={schedule.isPending} onClick={() => submit(false)}>Schedule</Button>}
      </>}>
      {errors.form && <div className="alert alert-error">{errors.form}</div>}
      {conflicts && (
        <div className="alert alert-warn" role="alert">
          <AlertTriangle size={18} style={{ flex: "none" }} />
          <div className="stack" style={{ gap: 4 }}>
            <strong>Scheduling conflict</strong>
            {conflicts.map((c) => (
              <span key={c.id} className="small">
                {c.reason === "interviewer" ? `${c.interviewer_name} is already interviewing ${c.candidate_name}` : `${c.candidate_name} already has an interview`} · {formatDate(c.start, true)} – {new Date(c.end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            ))}
            <span className="small">Pick another time, or schedule anyway.</span>
          </div>
        </div>
      )}
      <div className="grid grid-2">
        <Input label="Date" type="date" value={form.date} error={errors.date} onChange={(e) => set("date", e.target.value)} />
        <Input label="Time" type="time" value={form.time} onChange={(e) => set("time", e.target.value)} />
      </div>
      <div className="grid grid-2">
        <Input label="Duration (min)" type="number" min={15} max={240} step={15} value={form.duration_min} error={errors.duration_min} onChange={(e) => set("duration_min", e.target.value)} />
        <Select label="Type" value={form.type} options={INTERVIEW_TYPES} onChange={(e) => set("type", e.target.value)} />
      </div>
      <div className="grid grid-2">
        <Input label="Interviewer name" value={form.interviewer_name} error={errors.interviewer_name} onChange={(e) => set("interviewer_name", e.target.value)} />
        <Input label="Interviewer email (optional)" type="email" value={form.interviewer_email} error={errors.interviewer_email} onChange={(e) => set("interviewer_email", e.target.value)} />
      </div>
      <Input label="Location or meeting link (optional)" value={form.location_or_link} onChange={(e) => set("location_or_link", e.target.value)} />
    </Modal>
  );
}

function FeedbackModal({ a, iv, onClose }) {
  const blank = { technical: 3, communication: 3, problem_solving: 3, culture_fit: 3, recommendation: "yes", strengths: "", concerns: "" };
  const [form, setForm] = useState(blank);
  const [forId, setForId] = useState(null);
  if (iv && forId !== iv.id) { setForId(iv.id); setForm(iv.feedback ? { ...blank, ...iv.feedback } : blank); }
  const save = useApiMutation((f) => api.put(`/interviews/${iv.id}/feedback`, {
    technical: Number(f.technical), communication: Number(f.communication), problem_solving: Number(f.problem_solving),
    culture_fit: Number(f.culture_fit), recommendation: f.recommendation, strengths: f.strengths, concerns: f.concerns,
  }).then((r) => r.data), { invalidate: appKeys(a.id), success: "Feedback saved", onSuccess: () => { setForId(null); onClose(); } });
  if (!iv) return null;
  const ratings = { 1: "1 · Poor", 2: "2", 3: "3 · Meets", 4: "4", 5: "5 · Excellent" };
  return (
    <Modal open title="Interviewer feedback" onClose={() => { setForId(null); onClose(); }}
      footer={<><Button variant="secondary" onClick={() => { setForId(null); onClose(); }}>Cancel</Button><Button loading={save.isPending} onClick={() => save.mutate(form)}>Save feedback</Button></>}>
      <div className="grid grid-2">
        {["technical", "communication", "problem_solving", "culture_fit"].map((k) => (
          <Select key={k} label={k.replace("_", " ").replace(/^\w/, (c) => c.toUpperCase())} value={form[k]} options={ratings} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
        ))}
      </div>
      <Select label="Recommendation" value={form.recommendation} options={RECOMMENDATIONS} onChange={(e) => setForm({ ...form, recommendation: e.target.value })} />
      <Textarea label="Strengths" style={{ minHeight: 70 }} value={form.strengths} onChange={(e) => setForm({ ...form, strengths: e.target.value })} />
      <Textarea label="Concerns" style={{ minHeight: 70 }} value={form.concerns} onChange={(e) => setForm({ ...form, concerns: e.target.value })} />
    </Modal>
  );
}

/* ---------------- Notes & history ---------------- */
function NotesTab({ a }) {
  const [text, setText] = useState("");
  const add = useApiMutation((t) => api.post(`/applications/${a.id}/notes`, { text: t }).then((r) => r.data), {
    invalidate: [["application", a.id]], success: "Note added", onSuccess: () => setText(""),
  });
  return (
    <div className="grid grid-2" style={{ alignItems: "start" }}>
      <Card className="stack">
        <h2>Private notes</h2>
        <p className="small muted">Visible to recruiters only — never shown to the candidate.</p>
        <Textarea label="Add a note" style={{ minHeight: 80 }} value={text} onChange={(e) => setText(e.target.value)} />
        <div><Button disabled={!text.trim()} loading={add.isPending} onClick={() => add.mutate(text.trim())}><MessageSquarePlus size={16} /> Add note</Button></div>
        {(a.notes || []).length === 0 && <p className="muted small">No notes yet.</p>}
        {[...(a.notes || [])].reverse().map((n) => (
          <div key={n.id} className="card card-tight" style={{ boxShadow: "none" }}>
            <p style={{ whiteSpace: "pre-wrap" }}>{n.text}</p>
            <span className="small muted">{n.author_name} · {formatDate(n.at, true)}</span>
          </div>
        ))}
      </Card>
      <Card className="stack">
        <h2>Audit trail</h2>
        <p className="small muted">Every status change, who made it and when.</p>
        <AuditTimeline history={a.status_history} />
      </Card>
    </div>
  );
}
