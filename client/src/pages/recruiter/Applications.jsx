import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, Inbox, Search } from "lucide-react";
import { api } from "../../api/client";
import { useJobs } from "../../api/queries";
import { Card, EmptyState, ErrorState, ScoreRing, Skeleton, StatusBadge, clickableProps } from "../../components/ui";
import { formatDate } from "../../lib/status";

const TABS = [
  { id: "pending", label: "Pending review", statuses: ["submitted", "parsed", "ai_assessed", "recruiter_review"] },
  { id: "shortlisted", label: "Shortlisted", statuses: ["shortlisted"] },
  { id: "interview", label: "Interview", statuses: ["interview"] },
  { id: "decided", label: "Decided", statuses: ["selected", "rejected"] },
  { id: "all", label: "All", statuses: null },
];

export default function Applications() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((t) => t.id === params.get("tab")) || TABS[0];
  const q = params.get("q") || "";
  const sort = params.get("sort") || "score";
  const jobs = useJobs("all");

  // One request per job (reuses the per-job applicants endpoint and its cache).
  const results = useQueries({
    queries: (jobs.data || []).map((j) => ({
      queryKey: ["applicants", j.id, {}],
      queryFn: () => api.get(`/jobs/${j.id}/applications`).then((r) => r.data),
    })),
  });
  const loading = jobs.isLoading || results.some((r) => r.isLoading);
  const failed = jobs.isError || results.some((r) => r.isError);

  const all = useMemo(() => {
    const rows = [];
    (jobs.data || []).forEach((j, i) => {
      (results[i]?.data || []).forEach((a) => rows.push({ ...a, job: { id: j.id, title: j.title, status: j.status } }));
    });
    return rows;
  }, [jobs.data, results]);

  const counts = Object.fromEntries(TABS.map((t) => [t.id, t.statuses ? all.filter((a) => t.statuses.includes(a.status)).length : all.length]));
  const term = q.trim().toLowerCase();
  const rows = all
    .filter((a) => !tab.statuses || tab.statuses.includes(a.status))
    .filter((a) => !term || `${a.candidate.name} ${a.job.title}`.toLowerCase().includes(term))
    .sort((x, y) => (sort === "date"
      ? y.submitted_at.localeCompare(x.submitted_at)
      : (y.effective_score ?? -1) - (x.effective_score ?? -1)));

  const setParam = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    setParams(next, { replace: true });
  };
  const open = (a) => navigate(`/r/applications/${a.id}`);

  return (
    <div className="page">
      <div className="page-header">
        <div className="stack" style={{ gap: 4 }}>
          <h1>Applications</h1>
          <p className="muted">Every application across all your jobs, in one review queue.</p>
        </div>
      </div>

      <div className="segmented" role="tablist" aria-label="Application status" style={{ flexWrap: "wrap", alignSelf: "flex-start" }}>
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-pressed={tab.id === t.id} aria-selected={tab.id === t.id}
            onClick={() => setParam("tab", t.id === "pending" ? "" : t.id)}>
            {t.label} <span className="num muted">{loading ? "" : counts[t.id]}</span>
          </button>
        ))}
      </div>

      <Card className="stack">
        <div className="filter-bar">
          <div className="row" style={{ flex: "1 1 240px" }}>
            <Search size={16} className="muted" />
            <input className="input" placeholder="Search candidate or job" value={q} aria-label="Search applications"
              onChange={(e) => setParam("q", e.target.value)} />
          </div>
          <select className="select" value={sort} aria-label="Sort" onChange={(e) => setParam("sort", e.target.value === "score" ? "" : e.target.value)}>
            <option value="score">Sort: score</option>
            <option value="date">Sort: newest</option>
          </select>
        </div>
      </Card>

      {failed && <ErrorState message="Some applications could not be loaded." onRetry={() => { jobs.refetch(); results.forEach((r) => r.refetch()); }} />}
      {loading && <Card><Skeleton height={220} /></Card>}
      {!loading && rows.length === 0 && (
        <Card>
          <EmptyState icon={Inbox}
            title={term ? "No applications match your search" : `No ${tab.id === "all" ? "" : tab.label.toLowerCase() + " "}applications`}
            text={term ? "Try a different name or job title." : all.length === 0 ? "Applications appear here as candidates apply to your jobs." : "Nothing in this stage right now."}
            action={all.length === 0 && <Link className="btn btn-primary" to="/r/jobs">Go to jobs</Link>} />
        </Card>
      )}
      {!loading && rows.length > 0 && (
        <Card style={{ padding: 0 }}>
          <div className="table-wrap hide-mobile-table">
            <table className="table">
              <thead>
                <tr><th>Candidate</th><th>Job</th><th>Score</th><th>Status</th><th className="hide-tablet">Applied</th></tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} className="clickable" {...clickableProps(() => open(a))}>
                    <td>
                      <strong>{a.candidate.name}</strong>
                      {a.unverified_count > 0 && (
                        <div><span className="badge badge-absent" style={{ marginTop: 4 }}><AlertTriangle size={11} /> {a.unverified_count} unverified</span></div>
                      )}
                    </td>
                    <td>
                      {a.job.title}
                      {a.job.status === "closed" && <span className="badge badge-neutral" style={{ marginLeft: 6 }}>Closed</span>}
                    </td>
                    <td>
                      <div className="row">
                        <ScoreRing value={a.effective_score} size={42} stroke={5} />
                        {a.overridden && <span className="badge badge-primary">Overridden</span>}
                        {a.assessment_status === "failed" && <span className="badge badge-absent">AI failed</span>}
                      </div>
                    </td>
                    <td><StatusBadge status={a.status} /></td>
                    <td className="hide-tablet small muted">{formatDate(a.submitted_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="only-mobile">
            {rows.map((a) => (
              <div key={a.id} className="list-card" {...clickableProps(() => open(a))}>
                <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
                  <ScoreRing value={a.effective_score} size={44} stroke={5} />
                  <div className="stack grow" style={{ gap: 4 }}>
                    <div className="row between" style={{ alignItems: "flex-start" }}>
                      <strong>{a.candidate.name}</strong>
                      <StatusBadge status={a.status} />
                    </div>
                    <span className="small muted">{a.job.title} · {formatDate(a.submitted_at)}</span>
                    {(a.unverified_count > 0 || a.overridden) && (
                      <div className="row wrap" style={{ gap: 6 }}>
                        {a.overridden && <span className="badge badge-primary">Overridden</span>}
                        {a.unverified_count > 0 && <span className="badge badge-absent"><AlertTriangle size={11} /> {a.unverified_count} unverified</span>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
