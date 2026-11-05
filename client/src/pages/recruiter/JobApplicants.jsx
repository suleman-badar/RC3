import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Columns3, Pencil, Users } from "lucide-react";
import { useApplicants, useJob } from "../../api/queries";
import { Button, Card, EmptyState, ErrorState, MiniBreakdown, PageSkeleton, ScoreRing, SkillChip, SkillLegend, StatusBadge, clickableProps } from "../../components/ui";
import { IMPORTANCE, JOB_TYPES, STATUS, formatDate, formatSalary } from "../../lib/status";

export default function JobApplicants() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const filters = {
    status: params.get("status") || "",
    min_score: params.get("min_score") || "",
    skill: params.get("skill") || "",
    sort: params.get("sort") || "score",
  };
  const job = useJob(id);
  const apps = useApplicants(id, filters);
  const [selected, setSelected] = useState([]);

  const setFilter = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    setParams(next, { replace: true });
  };
  const toggle = (appId) =>
    setSelected((s) => (s.includes(appId) ? s.filter((x) => x !== appId) : s.length >= 3 ? s : [...s, appId]));

  if (job.isLoading) return <PageSkeleton />;
  if (job.isError) return <div className="page"><ErrorState message="Job not found." /></div>;
  const j = job.data;
  const allSkills = [...j.required_skills, ...(j.preferred_skills || [])];

  return (
    <div className="page">
      <Link to="/r/jobs" className="row small"><ArrowLeft size={14} /> Jobs</Link>
      <div className="page-header">
        <div className="stack" style={{ gap: 6 }}>
          <div className="row wrap">
            <h1>{j.title}</h1>
            <span className={`badge ${j.status === "open" ? "badge-match" : "badge-neutral"}`}>{j.status === "open" ? "Open" : "Closed"}</span>
          </div>
          <span className="muted">{j.department} · {j.location} · {JOB_TYPES[j.type]} · <span className="num">{formatSalary(j)}</span> · {j.min_experience_years}+ yrs</span>
          <div className="row wrap">
            {j.required_skills.map((s) => <span key={s.name} className="chip">{s.name}<span className="small muted">· {IMPORTANCE[s.importance]}</span></span>)}
          </div>
        </div>
        {j.is_owner && <Link className="btn btn-secondary" to={`/r/jobs/${id}/edit`}><Pencil size={15} /> Edit job</Link>}
      </div>

      <Card className="stack">
        <div className="filter-bar">
          <select className="select" value={filters.status} aria-label="Filter by status" onChange={(e) => setFilter("status", e.target.value)}>
            <option value="">All statuses</option>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select className="select" value={filters.skill} aria-label="Must have skill" onChange={(e) => setFilter("skill", e.target.value)}>
            <option value="">Any skill</option>
            {allSkills.map((s) => <option key={s.name} value={s.name}>Has evidence: {s.name}</option>)}
          </select>
          <select className="select" value={filters.sort} aria-label="Sort" onChange={(e) => setFilter("sort", e.target.value === "score" ? "" : e.target.value)}>
            <option value="score">Sort: score</option>
            <option value="date">Sort: newest</option>
          </select>
          <label className="row small" style={{ flex: "1 1 200px" }}>
            <span style={{ whiteSpace: "nowrap" }}>Min score</span>
            <input type="range" min={0} max={100} step={5} value={filters.min_score || 0} aria-label="Minimum score" style={{ flex: 1, minWidth: 80 }}
              onChange={(e) => setFilter("min_score", e.target.value === "0" ? "" : e.target.value)} />
            <span className="num" style={{ width: 24, textAlign: "right" }}>{filters.min_score || 0}</span>
          </label>
          <Button variant="secondary" disabled={selected.length < 2} onClick={() => navigate(`/r/compare?ids=${selected.join(",")}`)}
            title={selected.length < 2 ? "Select 2–3 applicants to compare" : ""}>
            <Columns3 size={16} /> Compare ({selected.length})
          </Button>
        </div>
        <SkillLegend />
      </Card>

      {apps.isLoading && <Card><div className="skeleton" style={{ height: 200 }} /></Card>}
      {apps.isError && <ErrorState message="Could not load applicants." onRetry={apps.refetch} />}
      {apps.data?.length === 0 && (
        <Card><EmptyState icon={Users} title={params.toString() ? "No applicants match these filters" : "No applicants yet"}
          text={params.toString() ? "Try relaxing the filters." : "Applications appear here, ranked by job-relevance score."} /></Card>
      )}
      {apps.data?.length > 0 && (
        <Card style={{ padding: 0 }}>
          <div className="table-wrap hide-mobile-table">
            <table className="table">
              <thead>
                <tr>
                  <th aria-label="Select for comparison" />
                  <th>#</th><th>Candidate</th><th>Score</th><th className="hide-tablet">Breakdown</th>
                  <th>Skill evidence</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {apps.data.map((a) => (
                  <tr key={a.id} className="clickable" {...clickableProps(() => navigate(`/r/applications/${a.id}`))}>
                    <td onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.includes(a.id)} onChange={() => toggle(a.id)} aria-label={`Select ${a.candidate.name} for comparison`} />
                    </td>
                    <td className="num muted">{a.rank}</td>
                    <td>
                      <strong>{a.candidate.name}</strong>
                      <div className="small muted">Applied {formatDate(a.submitted_at)}</div>
                      {a.unverified_count > 0 && <span className="badge badge-absent" style={{ marginTop: 4 }}><AlertTriangle size={11} /> {a.unverified_count} unverified claim{a.unverified_count > 1 ? "s" : ""}</span>}
                    </td>
                    <td>
                      <div className="row">
                        <ScoreRing value={a.effective_score} size={46} stroke={5} />
                        {a.overridden && <span className="badge badge-primary" title={`AI score ${a.ai_score}`}>Overridden</span>}
                        {a.assessment_status === "failed" && <span className="badge badge-absent">AI failed</span>}
                      </div>
                    </td>
                    <td className="hide-tablet"><MiniBreakdown breakdown={a.breakdown} /></td>
                    <td style={{ minWidth: 200 }}>
                      <div className="row wrap" style={{ maxWidth: 380, gap: 6 }}>
                        {a.skills.map((s) => <SkillChip key={s.skill} name={s.skill} state={s.state} required={s.required} />)}
                      </div>
                    </td>
                    <td><StatusBadge status={a.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="only-mobile">
            {apps.data.map((a) => (
              <div key={a.id} className="list-card" {...clickableProps(() => navigate(`/r/applications/${a.id}`))}>
                <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
                  <input type="checkbox" checked={selected.includes(a.id)} aria-label={`Select ${a.candidate.name} for comparison`}
                    onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} onChange={() => toggle(a.id)} style={{ marginTop: 14 }} />
                  <ScoreRing value={a.effective_score} size={46} stroke={5} />
                  <div className="stack grow" style={{ gap: 4 }}>
                    <div className="row between" style={{ alignItems: "flex-start" }}>
                      <strong>#{a.rank} {a.candidate.name}</strong>
                      <StatusBadge status={a.status} />
                    </div>
                    <div className="row wrap" style={{ gap: 6 }}>
                      {a.overridden && <span className="badge badge-primary">Overridden</span>}
                      {a.unverified_count > 0 && <span className="badge badge-absent"><AlertTriangle size={11} /> {a.unverified_count} unverified</span>}
                      {a.assessment_status === "failed" && <span className="badge badge-absent">AI failed</span>}
                    </div>
                  </div>
                </div>
                <div className="row wrap" style={{ gap: 6 }}>
                  {a.skills.map((s) => <SkillChip key={s.skill} name={s.skill} state={s.state} required={s.required} />)}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
      <p className="small muted">Scores rank applicants for review. Every shortlist and rejection decision is made manually by a recruiter.</p>
    </div>
  );
}
