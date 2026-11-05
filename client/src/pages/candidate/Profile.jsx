import { useEffect, useRef, useState } from "react";
import { FileUp, Plus, RefreshCw, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../api/client";
import { useApiMutation, useProfile } from "../../api/queries";
import { Button, Card, EmptyState, ErrorState, EvidenceQuote, Input, PageSkeleton, Textarea, VerifiedMark } from "../../components/ui";
import { formatDate } from "../../lib/status";

const STATUS_COPY = {
  none: { tone: "info", text: "No resume uploaded yet." },
  parsing: { tone: "info", text: "Reading your resume…" },
  parsed: { tone: "ok", text: "Resume parsed. Review the extracted data below and correct anything that's wrong." },
  empty: { tone: "warn", text: "We couldn't find readable text. Is this a scanned image? Upload a text-based PDF." },
  failed: { tone: "error", text: "Parsing failed." },
};

const SECTIONS = {
  experience: { title: "Experience", fields: [["title", "Job title"], ["company", "Company"], ["start", "Start"], ["end", "End"], ["years", "Years"], ["description", "Description", true]] },
  projects: { title: "Projects", fields: [["name", "Project name"], ["technologies", "Technologies (comma-separated)"], ["description", "Description", true]] },
  education: { title: "Education", fields: [["degree", "Degree"], ["institution", "Institution"], ["year", "Year"]] },
};

export default function CandidateProfile() {
  const profile = useProfile();
  const fileRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const [draft, setDraft] = useState(null);
  const [newSkill, setNewSkill] = useState("");

  useEffect(() => {
    if (profile.data?.parsed) setDraft(structuredClone(profile.data.parsed));
    else if (profile.data) setDraft(null);
  }, [profile.data]);

  const upload = useApiMutation(
    (file) => {
      const fd = new FormData();
      fd.append("file", file);
      return api.post("/profile/resume", fd).then((r) => r.data);
    },
    {
      invalidate: [["profile"]],
      success: (d) => (d.resume.parse_status === "parsed" ? "Resume parsed successfully" : null),
      onSuccess: (d) => d.resume.parse_status !== "parsed" && toast.warning(d.resume.parse_error || "Resume could not be parsed"),
    }
  );
  const reparse = useApiMutation(() => api.post("/profile/resume/reparse").then((r) => r.data), {
    invalidate: [["profile"]], success: "Resume re-parsed",
  });
  const save = useApiMutation((body) => api.put("/profile/me", body).then((r) => r.data), {
    invalidate: [["profile"]],
    success: "Profile saved",
    onSuccess: (d) => d.warning && toast.warning(d.warning),
  });

  const pick = (file) => {
    if (!file) return;
    const ext = file.name.toLowerCase().split(".").pop();
    if (!["pdf", "docx"].includes(ext)) return toast.error("Only PDF or DOCX resumes are supported");
    if (file.size > 5 * 1024 * 1024) return toast.error("File too large (max 5 MB)");
    upload.mutate(file);
  };

  if (profile.isLoading) return <PageSkeleton />;
  if (profile.isError) return <div className="page"><ErrorState message="Could not load your profile." onRetry={profile.refetch} /></div>;
  const p = profile.data;
  const st = upload.isPending ? "parsing" : p.resume?.parse_status || "none";
  const copy = STATUS_COPY[st] || STATUS_COPY.none;

  const setItem = (section, idx, key, value) =>
    setDraft((d) => ({ ...d, [section]: d[section].map((it, i) => (i === idx ? { ...it, [key]: value } : it)) }));
  const removeItem = (section, idx) => setDraft((d) => ({ ...d, [section]: d[section].filter((_, i) => i !== idx) }));
  const addItem = (section) => setDraft((d) => ({ ...d, [section]: [...(d[section] || []), {}] }));
  const addSkill = () => {
    const name = newSkill.trim();
    if (!name) return;
    if (draft.skills.some((s) => s.name.toLowerCase() === name.toLowerCase())) return toast.info("Skill already listed");
    setDraft((d) => ({ ...d, skills: [...d.skills, { name }] }));
    setNewSkill("");
  };
  const submit = () => {
    const body = {
      ...draft,
      projects: (draft.projects || []).map((pr) => ({
        ...pr,
        technologies: Array.isArray(pr.technologies) ? pr.technologies : String(pr.technologies || "").split(",").map((t) => t.trim()).filter(Boolean),
      })),
      total_years_experience: null,
      talent_pool_opt_in: p.talent_pool_opt_in !== false,
    };
    save.mutate(body);
  };
  const startManual = () =>
    setDraft({ contact: { name: "", email: "", phone: "", location: "", links: [] }, summary: "", skills: [], education: [], experience: [], projects: [], certifications: [] });

  return (
    <div className="page">
      <div className="page-header">
        <div className="stack" style={{ gap: 4 }}>
          <h1>Profile & resume</h1>
          <p className="muted">We extract your skills with evidence from your resume. You stay in control of the data.</p>
        </div>
        {draft && <Button onClick={submit} loading={save.isPending}><Save size={16} /> Save changes</Button>}
      </div>

      <Card className="stack">
        <div
          role="button" tabIndex={0} aria-label="Upload resume (PDF or DOCX, max 5 MB)"
          onClick={() => fileRef.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
          style={{
            border: `2px dashed ${drag ? "var(--primary)" : "var(--line)"}`, borderRadius: 12, padding: 28, textAlign: "center",
            background: drag ? "var(--primary-soft)" : "#fbfaf7", cursor: "pointer",
          }}
        >
          <input ref={fileRef} type="file" accept=".pdf,.docx" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
          {upload.isPending ? (
            <div className="stack" style={{ alignItems: "center" }}><span className="spinner" style={{ width: 22, height: 22 }} /><strong>Reading your resume…</strong><span className="small muted">Extracting text, skills and evidence with AI (≈10 s)</span></div>
          ) : (
            <div className="stack" style={{ alignItems: "center", gap: 6 }}>
              <FileUp size={26} className="muted" />
              <strong>{p.resume?.filename ? "Replace resume" : "Upload your resume"}</strong>
              <span className="small muted">Drag & drop or click · PDF (DOCX also accepted) · max 5 MB</span>
            </div>
          )}
        </div>
        <div className={`alert alert-${copy.tone}`}>
          <div className="grow stack" style={{ gap: 2 }}>
            <span>{copy.text}</span>
            {(st === "failed" || st === "empty") && p.resume?.parse_error && <span className="small">{p.resume.parse_error}</span>}
            {p.resume?.filename && <span className="small">{p.resume.filename} · uploaded {formatDate(p.resume.uploaded_at, true)}</span>}
          </div>
          {st === "failed" && p.resume?.has_text && <Button variant="secondary" size="sm" loading={reparse.isPending} onClick={() => reparse.mutate()}><RefreshCw size={14} /> Retry</Button>}
        </div>
        {p.unverified_claims?.length > 0 && (
          <div className="alert alert-warn">
            <span>{p.unverified_claims.length} extracted item(s) could not be matched to your resume text and are marked “Needs review”. They won't count until you confirm them by saving.</span>
          </div>
        )}
      </Card>

      {!draft && st !== "parsing" && (
        <Card><EmptyState title="No structured profile yet" text="Upload a resume above, or enter your details manually."
          action={<Button variant="secondary" onClick={startManual}>Enter manually</Button>} /></Card>
      )}

      {draft && (
        <>
          <Card className="stack">
            <h2>Contact</h2>
            <p className="small muted">Contact details are never used for scoring.</p>
            <div className="grid grid-2">
              {[["name", "Full name"], ["email", "Email"], ["phone", "Phone"], ["location", "Location"]].map(([k, l]) => (
                <Input key={k} label={l} value={draft.contact?.[k] || ""} onChange={(e) => setDraft({ ...draft, contact: { ...draft.contact, [k]: e.target.value } })} />
              ))}
            </div>
            <Textarea label="Summary" value={draft.summary || ""} style={{ minHeight: 80 }} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} />
          </Card>

          <Card className="stack">
            <div className="row between"><h2>Skills</h2><span className="small muted">Equivalent names are normalized (JS → JavaScript)</span></div>
            <div className="row wrap">
              {draft.skills.map((s, i) => (
                <span key={`${s.name}-${i}`} className="chip" title={s.excerpt ? `Evidence: “${s.excerpt}”` : "Added by you"}>
                  {s.name}
                  {s.raw && s.raw.toLowerCase() !== s.name.toLowerCase() && <span className="small muted">({s.raw})</span>}
                  {s.verified === false && <VerifiedMark verified={false} />}
                  <button type="button" className="chip-x" aria-label={`Remove ${s.name}`} onClick={() => removeItem("skills", i)}><X size={12} /></button>
                </span>
              ))}
              {draft.skills.length === 0 && <span className="muted small">No skills yet.</span>}
            </div>
            <div className="row">
              <input className="input" style={{ maxWidth: 260 }} placeholder="Add a skill" value={newSkill} aria-label="New skill"
                onChange={(e) => setNewSkill(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())} />
              <Button variant="secondary" onClick={addSkill}><Plus size={16} /> Add</Button>
            </div>
          </Card>

          {Object.entries(SECTIONS).map(([section, cfg]) => (
            <Card key={section} className="stack">
              <div className="row between">
                <h2>{cfg.title}</h2>
                <Button variant="secondary" size="sm" onClick={() => addItem(section)}><Plus size={14} /> Add</Button>
              </div>
              {(draft[section] || []).length === 0 && <span className="muted small">Nothing listed.</span>}
              {(draft[section] || []).map((it, i) => (
                <div key={it.id || i} className="stack" style={{ borderTop: i ? "1px solid var(--line)" : 0, paddingTop: i ? 14 : 0 }}>
                  <div className="row between">
                    <span className="row">{it.source === "candidate" ? <span className="badge badge-neutral">Edited by you</span> : <VerifiedMark verified={it.verified !== false} />}</span>
                    <Button variant="ghost" size="sm" onClick={() => removeItem(section, i)} aria-label="Remove item"><Trash2 size={14} /> Remove</Button>
                  </div>
                  <div className="grid grid-2">
                    {cfg.fields.filter((f) => !f[2]).map(([k, l]) => (
                      <Input key={k} label={l} value={Array.isArray(it[k]) ? it[k].join(", ") : it[k] ?? ""} onChange={(e) => setItem(section, i, k, e.target.value)} />
                    ))}
                  </div>
                  {cfg.fields.filter((f) => f[2]).map(([k, l]) => (
                    <Textarea key={k} label={l} style={{ minHeight: 70 }} value={it[k] || ""} onChange={(e) => setItem(section, i, k, e.target.value)} />
                  ))}
                  {it.excerpt && <EvidenceQuote text={it.excerpt} source={section} unverified={it.verified === false} />}
                </div>
              ))}
            </Card>
          ))}
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <Button onClick={submit} loading={save.isPending}><Save size={16} /> Save changes</Button>
          </div>
        </>
      )}
    </div>
  );
}
