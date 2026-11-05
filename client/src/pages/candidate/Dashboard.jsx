import { Link } from "react-router-dom";
import { Briefcase } from "lucide-react";
import { useMyApplications, useProfile } from "../../api/queries";
import { Card, EmptyState, ErrorState, Skeleton, StatusBadge, StatusTimeline } from "../../components/ui";
import { formatDate } from "../../lib/status";
import { useAuth } from "../../context/AuthContext";

export default function CandidateDashboard() {
  const { user } = useAuth();
  const apps = useMyApplications();
  const profile = useProfile();
  const parsed = profile.data?.resume?.parse_status === "parsed";

  return (
    <div className="page">
      <div className="page-header">
        <div className="stack" style={{ gap: 4 }}>
          <h1>Hi {user?.name?.split(" ")[0]} 👋</h1>
          <p className="muted">Track every application and where it stands.</p>
        </div>
        <Link className="btn btn-primary" to="/c/jobs"><Briefcase size={16} /> Browse jobs</Link>
      </div>

      {profile.data && !parsed && (
        <div className="alert alert-warn">
          <div className="grow">Upload your resume so we can build your structured profile before you apply.</div>
          <Link className="btn btn-secondary btn-sm" to="/c/profile">Upload resume</Link>
        </div>
      )}

      <section className="stack">
        <h2>My applications</h2>
        {apps.isLoading && <><Skeleton height={120} /><Skeleton height={120} /></>}
        {apps.isError && <ErrorState message="Could not load your applications." onRetry={apps.refetch} />}
        {apps.data?.length === 0 && (
          <Card><EmptyState title="No applications yet" text="Find an open role that fits you and apply in one click."
            action={<Link className="btn btn-primary" to="/c/jobs">Browse jobs</Link>} /></Card>
        )}
        {apps.data?.map((a) => (
          <Card key={a.id} className="stack">
            <div className="row between wrap">
              <div className="stack" style={{ gap: 2 }}>
                <h3>{a.job?.title}</h3>
                <span className="small muted">{a.job?.department} · {a.job?.location} · applied {formatDate(a.submitted_at)}</span>
              </div>
              <StatusBadge status={a.status} />
            </div>
            <StatusTimeline status={a.status} history={a.status_history} />
          </Card>
        ))}
      </section>
    </div>
  );
}
