import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Send } from "lucide-react";
import { api } from "../../api/client";
import { useApiMutation, useJob, useProfile } from "../../api/queries";
import { Button, Card, ErrorState, PageSkeleton } from "../../components/ui";
import { IMPORTANCE, JOB_TYPES, formatSalary } from "../../lib/status";

export default function CandidateJobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const job = useJob(id);
  const profile = useProfile();
  const apply = useApiMutation((jobId) => api.post("/applications", { job_id: jobId }).then((r) => r.data), {
    invalidate: [["myApps"], ["job", id], ["jobs"]],
    success: "Application submitted — AI assessment complete",
    onSuccess: () => navigate("/c"),
  });

  if (job.isLoading) return <PageSkeleton />;
  if (job.isError) return <div className="page"><ErrorState message="Job not found or no longer open." /></div>;
  const j = job.data;
  const parsed = profile.data?.resume?.parse_status === "parsed";

  return (
    <div className="page">
      <Link to="/c/jobs" className="row small"><ArrowLeft size={14} /> All jobs</Link>
      <div className="page-header">
        <div className="stack" style={{ gap: 4 }}>
          <h1>{j.title}</h1>
          <span className="muted">{j.department} · {j.location} · {JOB_TYPES[j.type]} · <span className="num">{formatSalary(j)}</span></span>
        </div>
        {j.has_applied ? (
          <span className="badge badge-match" style={{ fontSize: 14, padding: "6px 12px" }}>Applied ✓</span>
        ) : (
          <div className="stack" style={{ gap: 4, alignItems: "flex-end" }}>
            <Button onClick={() => apply.mutate(j.id)} loading={apply.isPending} disabled={!parsed}>
              <Send size={16} /> {apply.isPending ? "Applying & scoring…" : "Apply now"}
            </Button>
            {!parsed && <span className="small muted">Upload your resume first — <Link to="/c/profile">go to profile</Link></span>}
          </div>
        )}
      </div>
      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <Card className="stack">
          <h2>About the role</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>{j.description}</p>
        </Card>
        <Card className="stack">
          <h2>Requirements</h2>
          <span className="label">Required skills</span>
          <div className="row wrap">{j.required_skills.map((s) => <span key={s.name} className="chip">{s.name} <span className="small muted">· {IMPORTANCE[s.importance]}</span></span>)}</div>
          {j.preferred_skills?.length > 0 && <>
            <span className="label">Preferred</span>
            <div className="row wrap">{j.preferred_skills.map((s) => <span key={s.name} className="chip">{s.name}</span>)}</div>
          </>}
          <span className="label">Experience</span>
          <span>{j.min_experience_years}+ years</span>
          {j.qualifications?.length > 0 && <>
            <span className="label">Qualifications</span>
            <ul style={{ margin: 0, paddingLeft: 18 }}>{j.qualifications.map((q) => <li key={q}>{q}</li>)}</ul>
          </>}
        </Card>
      </div>
    </div>
  );
}
