import { useQueries } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CalendarClock, CalendarPlus } from "lucide-react";
import { api } from "../../api/client";
import { useInterviews, useJobs } from "../../api/queries";
import { Button, Card, EmptyState, ErrorState, InterviewStatusBadge, Skeleton, clickableProps } from "../../components/ui";
import { INTERVIEW_TYPES } from "../../lib/status";

const time = (iso) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** Applications in the Interview stage that have no active interview booked (e.g. moved there before dates were required). */
function useAwaitingDate(interviews) {
  const jobs = useJobs("all");
  const results = useQueries({
    queries: (jobs.data || []).map((j) => ({
      queryKey: ["applicants", j.id, {}],
      queryFn: () => api.get(`/jobs/${j.id}/applications`).then((r) => r.data),
    })),
  });
  const booked = new Set((interviews || []).filter((iv) => iv.status !== "cancelled").map((iv) => iv.application_id));
  const rows = [];
  (jobs.data || []).forEach((j, i) => (results[i]?.data || [])
    .filter((a) => a.status === "interview" && !booked.has(a.id))
    .forEach((a) => rows.push({ ...a, jobTitle: j.title })));
  return { rows, loading: jobs.isLoading || results.some((r) => r.isLoading) };
}

export default function Interviews() {
  const q = useInterviews();
  const awaiting = useAwaitingDate(q.data);
  const navigate = useNavigate();
  const groups = {};
  (q.data || []).forEach((iv) => {
    const key = new Date(iv.start).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    (groups[key] ||= []).push(iv);
  });
  return (
    <div className="page">
      <div className="stack" style={{ gap: 4 }}>
        <h1>Interview schedule</h1>
        <p className="muted">All scheduled interviews. Conflicts are flagged when booking.</p>
      </div>
      {q.isLoading && <Skeleton height={200} />}
      {q.isError && <ErrorState message="Could not load interviews." onRetry={q.refetch} />}
      {awaiting.rows.length > 0 && (
        <section className="stack">
          <div className="alert alert-warn" role="status">
            <AlertTriangle size={18} style={{ flex: "none" }} />
            <span>{awaiting.rows.length} candidate{awaiting.rows.length === 1 ? " is" : "s are"} in the Interview stage without a date. Set one so it appears on the schedule and the candidate is notified.</span>
          </div>
          <Card style={{ padding: 0 }}>
            {awaiting.rows.map((a) => (
              <div key={a.id} className="list-card" style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", cursor: "default" }}>
                <div className="stack" style={{ gap: 2, minWidth: 0 }}>
                  <strong>{a.candidate.name}</strong>
                  <span className="small muted">{a.jobTitle} · score {a.effective_score ?? "—"}</span>
                </div>
                <Button size="sm" onClick={() => navigate(`/r/applications/${a.id}?schedule=1`)}>
                  <CalendarPlus size={15} /> Set interview date
                </Button>
              </div>
            ))}
          </Card>
        </section>
      )}
      {q.data?.length === 0 && !awaiting.loading && awaiting.rows.length === 0 && <Card><EmptyState icon={CalendarClock} title="No interviews scheduled" text="Shortlist a candidate, then use Schedule interview on their application." /></Card>}
      {Object.entries(groups).map(([day, items]) => (
        <section key={day} className="stack">
          <span className="label">{day}</span>
          <Card style={{ padding: 0 }}>
            <div className="table-wrap hide-mobile-table">
              <table className="table">
                <thead><tr><th>Time</th><th>Candidate</th><th className="hide-mobile">Job</th><th>Interviewer</th><th className="hide-mobile">Type</th><th>Status</th></tr></thead>
                <tbody>
                  {items.map((iv) => (
                    <tr key={iv.id} className="clickable" {...clickableProps(() => navigate(`/r/applications/${iv.application_id}`))}>
                      <td className="num" style={{ whiteSpace: "nowrap" }}>{time(iv.start)}–{time(iv.end)}</td>
                      <td><strong>{iv.candidate.name}</strong></td>
                      <td className="hide-mobile">{iv.job.title}</td>
                      <td>{iv.interviewer_name}</td>
                      <td className="hide-mobile">{INTERVIEW_TYPES[iv.type]}</td>
                      <td>
                        <div className="row wrap">
                          <InterviewStatusBadge status={iv.status} />
                          {iv.conflict_overridden && <span className="badge badge-missing" title="Booked despite a conflict"><AlertTriangle size={11} /> Conflict</span>}
                          {iv.has_feedback && <span className="badge badge-primary">Feedback</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="only-mobile">
              {items.map((iv) => (
                <div key={iv.id} className="list-card" {...clickableProps(() => navigate(`/r/applications/${iv.application_id}`))}>
                  <div className="row between">
                    <strong className="num">{time(iv.start)}–{time(iv.end)}</strong>
                    <InterviewStatusBadge status={iv.status} />
                  </div>
                  <span><strong>{iv.candidate.name}</strong> · {iv.job.title}</span>
                  <span className="small muted">{INTERVIEW_TYPES[iv.type]} with {iv.interviewer_name}</span>
                  {(iv.conflict_overridden || iv.has_feedback) && (
                    <div className="row wrap">
                      {iv.conflict_overridden && <span className="badge badge-missing"><AlertTriangle size={11} /> Conflict</span>}
                      {iv.has_feedback && <span className="badge badge-primary">Feedback</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </section>
      ))}
    </div>
  );
}
