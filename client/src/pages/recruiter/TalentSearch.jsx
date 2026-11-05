import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, Sparkles, Users } from "lucide-react";
import { api } from "../../api/client";
import { useApiMutation, useJobs } from "../../api/queries";
import { Button, Card, EmptyState, EvidenceQuote } from "../../components/ui";

const EXAMPLES = ["Python developers with REST API experience", "Someone who has containerized services", "Frontend engineer with React dashboards", "Experience tuning database performance"];

export default function TalentSearch() {
  const [query, setQuery] = useState("");
  const [jobId, setJobId] = useState("");
  const [error, setError] = useState("");
  const jobs = useJobs("all");
  const search = useApiMutation((body) => api.post("/search/talent", body).then((r) => r.data));

  const run = (q = query) => {
    if (q.trim().length < 3) return setError("Type at least 3 characters");
    setError("");
    setQuery(q);
    search.mutate({ query: q.trim(), job_id: jobId || null, limit: 10 });
  };

  return (
    <div className="page">
      <div className="stack" style={{ gap: 4 }}>
        <h1>Talent search</h1>
        <p className="muted">Natural-language, semantic search over applicant resumes. Finds people even when their wording differs.</p>
      </div>
      <Card className="stack">
        <form className="row wrap" onSubmit={(e) => { e.preventDefault(); run(); }}>
          <div className="row grow" style={{ minWidth: 260 }}>
            <Search size={18} className="muted" />
            <input className="input" style={{ height: 44, fontSize: 15 }} placeholder="e.g. Python developers with REST API experience"
              value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search query" aria-invalid={!!error} />
          </div>
          <select className="select" style={{ width: 220, height: 44 }} value={jobId} onChange={(e) => setJobId(e.target.value)} aria-label="Scope">
            <option value="">All applicants</option>
            {(jobs.data || []).map((j) => <option key={j.id} value={j.id}>Applicants for {j.title}</option>)}
          </select>
          <Button type="submit" loading={search.isPending} style={{ height: 44 }}><Sparkles size={16} /> Search</Button>
        </form>
        {error && <span className="error-text">{error}</span>}
        <div className="row wrap">
          {EXAMPLES.map((ex) => <button key={ex} type="button" className="chip" onClick={() => run(ex)}>{ex}</button>)}
        </div>
      </Card>

      {search.isPending && <Card><div className="skeleton" style={{ height: 120 }} /></Card>}
      {search.data && search.data.length === 0 && <Card><EmptyState icon={Users} title="No matching applicants" text="Try broader wording, or search all applicants." /></Card>}
      {search.data?.map((r) => (
        <Card key={r.candidate.id} className="stack">
          <div className="row between wrap">
            <div className="stack" style={{ gap: 2 }}>
              <h3>{r.candidate.name}</h3>
              <span className="small muted">Applied to: {r.applications.map((a) => a.job_title).join(", ")}</span>
            </div>
            <div className="row">
              <span className="badge badge-semantic num">Relevance {Math.round(r.relevance * 100)}%</span>
              {r.applications[0] && <Link className="btn btn-secondary btn-sm" to={`/r/applications/${r.applications[0].id}`}>View application</Link>}
            </div>
          </div>
          <div className="grid grid-3">
            {r.evidence.map((e, i) => (
              <div key={i} className="stack" style={{ gap: 4 }}>
                <EvidenceQuote text={e.text} source={e.kind} />
                <span className="small muted num">similarity {e.similarity.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
