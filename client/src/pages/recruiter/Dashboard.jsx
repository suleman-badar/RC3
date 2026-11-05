import { useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Briefcase, CalendarClock, ClipboardCheck, Clock, FileStack, Percent, Plus, UserCheck } from "lucide-react";
import { useAnalytics, useJobs } from "../../api/queries";
import { Card, EmptyState, ErrorState, PageSkeleton, StatCard } from "../../components/ui";

const STAGE_COLORS = {
  submitted: "#9aa1ab", parsed: "#9aa1ab", ai_assessed: "#1d4ed8", recruiter_review: "#0e6e64",
  shortlisted: "#15803d", interview: "#7c3aed", selected: "#166534", rejected: "#b91c1c",
};

export default function RecruiterDashboard() {
  const [jobId, setJobId] = useState("");
  const analytics = useAnalytics(jobId);
  const jobs = useJobs("all");

  if (analytics.isLoading) return <PageSkeleton />;
  if (analytics.isError) return <div className="page"><ErrorState message="Could not load analytics." onRetry={analytics.refetch} /></div>;
  const { kpis, by_job, by_stage, skill_gaps } = analytics.data;
  const noJobs = (jobs.data || []).length === 0;

  return (
    <div className="page">
      <div className="page-header">
        <div className="stack" style={{ gap: 4 }}>
          <h1>Recruitment overview</h1>
          <p className="muted">Live pipeline metrics across your vacancies.</p>
        </div>
        <div className="row wrap">
          <select className="select" style={{ width: 220 }} value={jobId} onChange={(e) => setJobId(e.target.value)} aria-label="Filter by job">
            <option value="">All jobs</option>
            {(jobs.data || []).map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
          </select>
          <Link className="btn btn-primary" to="/r/jobs/new"><Plus size={16} /> Post a job</Link>
        </div>
      </div>

      {noJobs ? (
        <Card><EmptyState icon={Briefcase} title="Post your first job" text="Publish a vacancy to start receiving and assessing applications."
          action={<Link className="btn btn-primary" to="/r/jobs/new">Post a job</Link>} /></Card>
      ) : (
        <>
          <div className="grid grid-kpi">
            <StatCard label="Active jobs" value={kpis.active_jobs} icon={Briefcase} />
            <StatCard label="Applications" value={kpis.applications} icon={FileStack} />
            <StatCard label="Shortlisted" value={kpis.shortlisted} icon={UserCheck} hint="currently in Shortlisted" />
            <StatCard label="Pending reviews" value={kpis.pending_reviews} icon={ClipboardCheck} />
            <StatCard label="Interviews" value={kpis.interviews} icon={CalendarClock} hint="upcoming" />
            <StatCard label="App → shortlist" value={`${Math.round(kpis.shortlist_rate * 100)}%`} icon={Percent} hint={`${kpis.shortlisted_ever} ever shortlisted`} />
            <StatCard label="Avg processing" value={kpis.avg_processing_hours == null ? "—" : `${kpis.avg_processing_hours} h`} icon={Clock} hint="submitted → first decision" />
          </div>

          <div className="grid grid-2">
            <Card className="stack">
              <h2>Applications by job</h2>
              <div style={{ height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={by_job} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e2dc" vertical={false} />
                    <XAxis dataKey="title" tick={{ fontSize: 12 }} interval={0} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="applications" name="Applications" fill="#0e6e64" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="shortlisted" name="Shortlisted" fill="#e2b33f" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="stack">
              <h2>Pipeline by stage</h2>
              <div style={{ height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={by_stage} layout="vertical" margin={{ top: 4, right: 16, left: 40, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e2dc" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={110} />
                    <Tooltip />
                    <Bar dataKey="count" name="Applications" radius={[0, 6, 6, 0]}>
                      {by_stage.map((s) => <Cell key={s.status} fill={STAGE_COLORS[s.status]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <Card className="stack">
            <div className="row between wrap">
              <h2>Common skill gaps</h2>
              <span className="small muted">Required skills with no evidence (or confirmed absent) across assessed applicants</span>
            </div>
            {skill_gaps.length === 0 ? <p className="muted">No gaps detected yet.</p> : (
              <div className="stack">
                {skill_gaps.map((g) => (
                  <div key={g.skill} className="row">
                    <span style={{ width: 160, fontWeight: 500 }}>{g.skill}</span>
                    <div className="bar grow"><span style={{ width: `${Math.round(g.share * 100)}%`, background: "#b45309" }} /></div>
                    <span className="num small" style={{ width: 110, textAlign: "right" }}>{g.count} applicant{g.count === 1 ? "" : "s"} · {Math.round(g.share * 100)}%</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
