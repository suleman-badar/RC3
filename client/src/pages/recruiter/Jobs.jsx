import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Briefcase, Pencil, Plus } from "lucide-react";
import { api } from "../../api/client";
import { useApiMutation, useJobs } from "../../api/queries";
import { Button, Card, EmptyState, ErrorState, Modal, Skeleton, clickableProps } from "../../components/ui";
import { formatDate } from "../../lib/status";

export default function RecruiterJobs() {
  const [filter, setFilter] = useState("all");
  const jobs = useJobs(filter);
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(null);
  const toggle = useApiMutation(({ id, status }) => api.patch(`/jobs/${id}/status`, { status }).then((r) => r.data), {
    invalidate: [["jobs"], ["analytics"]],
    success: (d) => (d.status === "open" ? "Job reopened" : "Job closed"),
    onSuccess: () => setConfirm(null),
  });

  return (
    <div className="page">
      <div className="page-header">
        <div className="stack" style={{ gap: 4 }}>
          <h1>Jobs</h1>
          <p className="muted">Create, edit, close and reopen vacancies.</p>
        </div>
        <div className="row">
          <div className="segmented" role="group" aria-label="Status filter">
            {["all", "open", "closed"].map((s) => (
              <button key={s} aria-pressed={filter === s} onClick={() => setFilter(s)}>{s[0].toUpperCase() + s.slice(1)}</button>
            ))}
          </div>
          <Link className="btn btn-primary" to="/r/jobs/new"><Plus size={16} /> New job</Link>
        </div>
      </div>
      {jobs.isLoading && <Skeleton height={240} />}
      {jobs.isError && <ErrorState message="Could not load jobs." onRetry={jobs.refetch} />}
      {jobs.data?.length === 0 && (
        <Card><EmptyState icon={Briefcase} title="No jobs here" text="Post a vacancy to start receiving applications."
          action={<Link className="btn btn-primary" to="/r/jobs/new">New job</Link>} /></Card>
      )}
      {jobs.data?.length > 0 && (
        <Card style={{ padding: 0 }}>
          <div className="table-wrap hide-mobile-table">
            <table className="table">
              <thead><tr><th>Title</th><th className="hide-mobile">Department</th><th>Status</th><th>Applicants</th><th className="hide-mobile">Created</th><th aria-label="Actions" /></tr></thead>
              <tbody>
                {jobs.data.map((j) => (
                  <tr key={j.id} className="clickable" {...clickableProps(() => navigate(`/r/jobs/${j.id}`))}>
                    <td><strong>{j.title}</strong><div className="small muted">{j.location}</div></td>
                    <td className="hide-mobile">{j.department}</td>
                    <td><span className={`badge ${j.status === "open" ? "badge-match" : "badge-neutral"}`}>{j.status === "open" ? "Open" : "Closed"}</span></td>
                    <td className="num"><strong>{j.applicant_count}</strong></td>
                    <td className="hide-mobile small muted">{formatDate(j.created_at)}</td>
                    <td onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                      {j.is_owner && (
                        <div className="row" style={{ justifyContent: "flex-end" }}>
                          <Link className="btn btn-ghost btn-sm" to={`/r/jobs/${j.id}/edit`} aria-label={`Edit ${j.title}`}><Pencil size={14} /> <span className="hide-mobile">Edit</span></Link>
                          <Button variant="secondary" size="sm" onClick={() => setConfirm(j)}>{j.status === "open" ? "Close" : "Reopen"}</Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="only-mobile">
            {jobs.data.map((j) => (
              <div key={j.id} className="list-card" {...clickableProps(() => navigate(`/r/jobs/${j.id}`))}>
                <div className="row between" style={{ alignItems: "flex-start" }}>
                  <div className="stack grow" style={{ gap: 2 }}>
                    <strong>{j.title}</strong>
                    <span className="small muted">{j.department} · {j.location}</span>
                  </div>
                  <span className={`badge ${j.status === "open" ? "badge-match" : "badge-neutral"}`}>{j.status === "open" ? "Open" : "Closed"}</span>
                </div>
                <div className="row between">
                  <span className="small"><strong className="num">{j.applicant_count}</strong> applicant{j.applicant_count === 1 ? "" : "s"} · {formatDate(j.created_at)}</span>
                  {j.is_owner && (
                    <div className="row" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                      <Link className="btn btn-ghost btn-sm" to={`/r/jobs/${j.id}/edit`} aria-label={`Edit ${j.title}`}><Pencil size={14} /></Link>
                      <Button variant="secondary" size="sm" onClick={() => setConfirm(j)}>{j.status === "open" ? "Close" : "Reopen"}</Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
      <Modal open={!!confirm} title={confirm?.status === "open" ? "Close this job?" : "Reopen this job?"} onClose={() => setConfirm(null)}
        footer={<>
          <Button variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button>
          <Button variant={confirm?.status === "open" ? "danger" : "primary"} loading={toggle.isPending}
            onClick={() => toggle.mutate({ id: confirm.id, status: confirm.status === "open" ? "closed" : "open" })}>
            {confirm?.status === "open" ? "Close job" : "Reopen job"}
          </Button>
        </>}>
        <p>{confirm?.status === "open"
          ? `“${confirm?.title}” will be hidden from candidates and stop accepting applications. Existing applications are kept.`
          : `“${confirm?.title}” will be visible to candidates again.`}</p>
      </Modal>
    </div>
  );
}
