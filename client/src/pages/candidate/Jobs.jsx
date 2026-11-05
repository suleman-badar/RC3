import { useState } from "react";
import { Link } from "react-router-dom";
import { Briefcase, MapPin, Search } from "lucide-react";
import { useJobs } from "../../api/queries";
import { Card, EmptyState, ErrorState, Skeleton } from "../../components/ui";
import { JOB_TYPES, formatSalary } from "../../lib/status";

export default function CandidateJobs() {
  const jobs = useJobs("open");
  const [q, setQ] = useState("");
  const list = (jobs.data || []).filter((j) =>
    `${j.title} ${j.department} ${j.location} ${j.required_skills.map((s) => s.name).join(" ")}`.toLowerCase().includes(q.toLowerCase())
  );
  return (
    <div className="page">
      <div className="page-header">
        <div className="stack" style={{ gap: 4 }}>
          <h1>Open positions</h1>
          <p className="muted">Apply with your parsed profile — recruiters see evidence, not just keywords.</p>
        </div>
        <div className="row" style={{ minWidth: 260 }}>
          <Search size={16} className="muted" />
          <input className="input" placeholder="Filter by title, skill, location" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter jobs" />
        </div>
      </div>
      {jobs.isLoading && <div className="grid grid-3"><Skeleton height={160} /><Skeleton height={160} /><Skeleton height={160} /></div>}
      {jobs.isError && <ErrorState message="Could not load jobs." onRetry={jobs.refetch} />}
      {jobs.data && list.length === 0 && <Card><EmptyState icon={Briefcase} title="No open positions" text="Check back soon." /></Card>}
      <div className="grid grid-3">
        {list.map((j) => (
          <Link key={j.id} to={`/c/jobs/${j.id}`} style={{ textDecoration: "none", color: "inherit" }}>
            <Card className="card-hover stack" style={{ height: "100%" }}>
              <div className="row between">
                <span className="badge badge-primary">{JOB_TYPES[j.type]}</span>
                {j.has_applied && <span className="badge badge-match">Applied ✓</span>}
              </div>
              <h3>{j.title}</h3>
              <span className="small muted row"><MapPin size={13} /> {j.location} · {j.department}</span>
              <span className="small num">{formatSalary(j)}</span>
              <div className="row wrap">
                {j.required_skills.slice(0, 5).map((s) => <span key={s.name} className="chip">{s.name}</span>)}
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
