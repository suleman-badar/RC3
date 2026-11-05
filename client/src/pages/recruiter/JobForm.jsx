import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage } from "../../api/client";
import { useApiMutation, useJob } from "../../api/queries";
import { Button, Card, Input, PageSkeleton, Select, Textarea } from "../../components/ui";
import { IMPORTANCE, JOB_TYPES } from "../../lib/status";

const EMPTY = {
  title: "", department: "", location: "", type: "full_time", salary_min: "", salary_max: "", currency: "PKR",
  description: "", required_skills: [{ name: "", importance: "important" }], preferred_skills: [],
  min_experience_years: 0, qualifications: [],
};

function SkillRows({ label, rows, onChange, highlight, defaultImportance }) {
  const set = (i, k, v) => onChange(rows.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  return (
    <div className="stack">
      <div className="row between"><span className="label">{label}</span>
        <Button variant="ghost" size="sm" type="button" onClick={() => onChange([...rows, { name: "", importance: defaultImportance }])}><Plus size={14} /> Add</Button>
      </div>
      {rows.length === 0 && <span className="small muted">None.</span>}
      {rows.map((r, i) => (
        <div key={i} className="row" style={{ background: highlight ? "var(--evidence)" : "transparent", borderRadius: 8, transition: "background 600ms" }}>
          <input className="input grow" placeholder="Skill" value={r.name} aria-label={`${label} ${i + 1}`} onChange={(e) => set(i, "name", e.target.value)} />
          <select className="select" style={{ width: 150 }} value={r.importance} aria-label="Importance" onChange={(e) => set(i, "importance", e.target.value)}>
            {Object.entries(IMPORTANCE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button type="button" className="btn btn-ghost btn-icon" aria-label="Remove skill" onClick={() => onChange(rows.filter((_, idx) => idx !== i))}><Trash2 size={15} /></button>
        </div>
      ))}
    </div>
  );
}

export default function JobForm() {
  const { id } = useParams();
  const editing = !!id;
  const navigate = useNavigate();
  const existing = useJob(id);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [extracting, setExtracting] = useState(false);
  const [highlight, setHighlight] = useState(false);
  const [qualText, setQualText] = useState("");

  useEffect(() => {
    if (editing && existing.data) {
      const j = existing.data;
      setForm({ ...EMPTY, ...j });
      setQualText((j.qualifications || []).join("\n"));
    }
  }, [editing, existing.data]);

  const save = useApiMutation(
    (body) => (editing ? api.put(`/jobs/${id}`, body) : api.post("/jobs", body)).then((r) => r.data),
    {
      invalidate: [["jobs"], ["job", id], ["analytics"]],
      success: editing ? "Job updated" : "Job published",
      onSuccess: (job) => navigate(`/r/jobs/${job.id}`),
    }
  );

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const extract = async () => {
    if (form.description.trim().length < 30) {
      setErrors((e) => ({ ...e, description: "Write at least 30 characters so the AI has something to work with" }));
      return;
    }
    setExtracting(true);
    try {
      const { data } = await api.post("/jobs/extract-requirements", { description: form.description });
      setForm((f) => ({
        ...f,
        required_skills: data.required_skills.length ? data.required_skills : f.required_skills,
        preferred_skills: data.preferred_skills,
        min_experience_years: data.min_experience_years,
        qualifications: data.qualifications,
      }));
      setQualText(data.qualifications.join("\n"));
      setHighlight(true);
      setTimeout(() => setHighlight(false), 2000);
      toast.success(`Extracted ${data.required_skills.length} required and ${data.preferred_skills.length} preferred skills — review before saving`);
    } catch (err) {
      toast.error(`${errorMessage(err)} — fill the requirements manually or retry`);
    } finally {
      setExtracting(false);
    }
  };

  const validate = () => {
    const e = {};
    if (form.title.trim().length < 3) e.title = "Title must be at least 3 characters";
    if (!form.department.trim()) e.department = "Required";
    if (!form.location.trim()) e.location = "Required";
    if (form.salary_min === "" || Number(form.salary_min) < 0) e.salary_min = "Enter a valid amount";
    if (form.salary_max === "" || Number(form.salary_max) < 0) e.salary_max = "Enter a valid amount";
    if (!e.salary_min && !e.salary_max && Number(form.salary_min) > Number(form.salary_max)) e.salary_max = "Must be ≥ minimum salary";
    if (form.description.trim().length < 30) e.description = "At least 30 characters";
    if (!form.required_skills.some((s) => s.name.trim())) e.required_skills = "Add at least one required skill";
    const yrs = Number(form.min_experience_years);
    if (Number.isNaN(yrs) || yrs < 0 || yrs > 40) e.min_experience_years = "0–40 years";
    return e;
  };

  const submit = (ev) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return toast.error("Please fix the highlighted fields");
    save.mutate({
      title: form.title, department: form.department, location: form.location, type: form.type,
      salary_min: Number(form.salary_min), salary_max: Number(form.salary_max), currency: (form.currency || "PKR").toUpperCase(),
      description: form.description,
      required_skills: form.required_skills.filter((s) => s.name.trim()),
      preferred_skills: form.preferred_skills.filter((s) => s.name.trim()),
      min_experience_years: Number(form.min_experience_years),
      qualifications: qualText.split("\n").map((q) => q.trim()).filter(Boolean),
    });
  };

  if (editing && existing.isLoading) return <PageSkeleton />;

  return (
    <form className="page" onSubmit={submit} noValidate>
      <Link to="/r/jobs" className="row small"><ArrowLeft size={14} /> Jobs</Link>
      <div className="page-header">
        <h1>{editing ? "Edit job" : "Post a new job"}</h1>
        <div className="row">
          <Link className="btn btn-secondary" to="/r/jobs">Cancel</Link>
          <Button type="submit" loading={save.isPending}>{editing ? "Save changes" : "Publish job"}</Button>
        </div>
      </div>
      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <Card className="stack">
          <h2>Basics</h2>
          <Input label="Job title" value={form.title} error={errors.title} onChange={(e) => set("title", e.target.value)} />
          <div className="grid grid-2">
            <Input label="Department" value={form.department} error={errors.department} onChange={(e) => set("department", e.target.value)} />
            <Input label="Location" value={form.location} error={errors.location} onChange={(e) => set("location", e.target.value)} />
          </div>
          <div className="grid grid-2">
            <Select label="Type" value={form.type} options={JOB_TYPES} onChange={(e) => set("type", e.target.value)} />
            <Input label="Currency" value={form.currency} maxLength={3} onChange={(e) => set("currency", e.target.value)} />
          </div>
          <div className="grid grid-2">
            <Input label="Salary min" type="number" min={0} value={form.salary_min} error={errors.salary_min} onChange={(e) => set("salary_min", e.target.value)} />
            <Input label="Salary max" type="number" min={0} value={form.salary_max} error={errors.salary_max} onChange={(e) => set("salary_max", e.target.value)} />
          </div>
          <Textarea label="Description" value={form.description} error={errors.description} style={{ minHeight: 200 }}
            hint="Paste the full job description, then let AI extract the requirements."
            onChange={(e) => set("description", e.target.value)} />
          <Button type="button" variant="secondary" loading={extracting} onClick={extract}>
            <Sparkles size={16} /> {extracting ? "Extracting requirements…" : "Extract requirements with AI"}
          </Button>
        </Card>
        <Card className="stack">
          <h2>Requirements</h2>
          <p className="small muted">These drive the explainable score. Importance sets each skill's weight (critical 3 · important 2 · nice 1).</p>
          <SkillRows label="Required skills" rows={form.required_skills} highlight={highlight} defaultImportance="important"
            onChange={(rows) => set("required_skills", rows)} />
          {errors.required_skills && <span className="error-text">{errors.required_skills}</span>}
          <SkillRows label="Preferred skills" rows={form.preferred_skills} highlight={highlight} defaultImportance="nice"
            onChange={(rows) => set("preferred_skills", rows)} />
          <Input label="Minimum experience (years)" type="number" min={0} max={40} step="0.5" value={form.min_experience_years}
            error={errors.min_experience_years} onChange={(e) => set("min_experience_years", e.target.value)} />
          <Textarea label="Qualifications (one per line)" style={{ minHeight: 80, background: highlight ? "var(--evidence)" : undefined }}
            value={qualText} onChange={(e) => setQualText(e.target.value)} />
        </Card>
      </div>
    </form>
  );
}
