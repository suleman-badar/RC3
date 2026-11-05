import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { api, errorMessage } from "../../api/client";
import { Card, ErrorState, EvidenceQuote, PageSkeleton, ScoreBreakdown, ScoreRing, SkillChip, SkillLegend, StatusBadge } from "../../components/ui";
import { SKILL_STATES } from "../../lib/status";

export default function Compare() {
  const [params] = useSearchParams();
  const ids = (params.get("ids") || "").split(",").filter(Boolean);
  const q = useQuery({
    queryKey: ["compare", ids.join(",")],
    queryFn: () => api.post("/applications/compare", { ids }).then((r) => r.data),
    enabled: ids.length >= 2,
  });
  if (ids.length < 2) return <div className="page"><ErrorState message="Select 2–3 applicants on a job page to compare." /></div>;
  if (q.isLoading) return <PageSkeleton />;
  if (q.isError) return <div className="page"><ErrorState message={errorMessage(q.error)} onRetry={q.refetch} /></div>;
  const { job, skills, candidates } = q.data;
  const cols = { gridTemplateColumns: `repeat(${candidates.length}, minmax(260px, 1fr))` };

  return (
    <div className="page">
      <Link to={`/r/jobs/${job.id}`} className="row small"><ArrowLeft size={14} /> {job.title} applicants</Link>
      <div className="page-header">
        <div className="stack" style={{ gap: 4 }}>
          <h1>Compare candidates</h1>
          <p className="muted">Side-by-side job-related evidence for {job.title}. Personal attributes are not shown or scored.</p>
        </div>
        <SkillLegend />
      </div>
      <div className="h-scroll">
        <div className="grid" style={cols}>
          {candidates.map((c) => (
            <Card key={c.id} className="stack">
              <div className="row between">
                <Link to={`/r/applications/${c.id}`}><h2>{c.name}</h2></Link>
                <StatusBadge status={c.status} />
              </div>
              <div className="row"><ScoreRing value={c.effective_score} size={72} stroke={7} />
                <span className="small muted">{c.effective_score !== c.ai_score ? `AI score ${c.ai_score} (overridden)` : "AI score"} · {c.total_years} yrs experience</span></div>
              <ScoreBreakdown breakdown={c.breakdown} />
            </Card>
          ))}
        </div>
        <Card className="stack" style={{ marginTop: 16 }}>
          <h2>Skill by skill</h2>
          {skills.map((skill) => (
            <div key={skill} className="stack" style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
              <strong>{skill}</strong>
              <div className="grid" style={cols}>
                {candidates.map((c) => {
                  const s = c.skills_by_name[skill];
                  return (
                    <div key={c.id} className="stack" style={{ gap: 6 }}>
                      {s ? <SkillChip name={SKILL_STATES[s.state].label} state={s.state} similarity={s.similarity} /> : <span className="muted small">—</span>}
                      {s?.evidence?.text && <EvidenceQuote text={s.evidence.text} source={s.evidence.source} />}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </Card>
        <div className="grid" style={{ ...cols, marginTop: 16 }}>
          {candidates.map((c) => (
            <Card key={c.id} className="stack">
              <h3>{c.name}: explanation</h3>
              <p className="small">{c.summary || "No narrative explanation available."}</p>
              {(c.missing_info.length > 0 || c.unverified_claims.length > 0) && <span className="label">Missing / unverified information</span>}
              {c.missing_info.map((m) => <span key={m} className="small row"><AlertTriangle size={13} color="#b45309" /> {m}</span>)}
              {c.unverified_claims.map((u, i) => <span key={i} className="small row"><AlertTriangle size={13} color="#b91c1c" /> Unverified {u.section}: {u.item}</span>)}
              {c.gaps.length > 0 && <>
                <span className="label">Gaps</span>
                <div className="row wrap">{c.gaps.map((g) => <SkillChip key={g.skill} name={g.skill} state={g.state} required={g.required} />)}</div>
              </>}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
