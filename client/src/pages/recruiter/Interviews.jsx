import { useNavigate } from "react-router-dom";
import { AlertTriangle, CalendarClock } from "lucide-react";
import { useInterviews } from "../../api/queries";
import { Card, EmptyState, ErrorState, Skeleton } from "../../components/ui";
import { INTERVIEW_TYPES } from "../../lib/status";

export default function Interviews() {
  const q = useInterviews();
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
      {q.data?.length === 0 && <Card><EmptyState icon={CalendarClock} title="No interviews scheduled" text="Shortlist a candidate and schedule an interview from their application." /></Card>}
      {Object.entries(groups).map(([day, items]) => (
        <section key={day} className="stack">
          <span className="label">{day}</span>
          <Card style={{ padding: 0 }}>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Time</th><th>Candidate</th><th className="hide-mobile">Job</th><th>Interviewer</th><th className="hide-mobile">Type</th><th>Status</th></tr></thead>
                <tbody>
                  {items.map((iv) => (
                    <tr key={iv.id} className="clickable" onClick={() => navigate(`/r/applications/${iv.application_id}`)}>
                      <td className="num">
                        {new Date(iv.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}–{new Date(iv.end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td><strong>{iv.candidate.name}</strong></td>
                      <td className="hide-mobile">{iv.job.title}</td>
                      <td>{iv.interviewer_name}</td>
                      <td className="hide-mobile">{INTERVIEW_TYPES[iv.type]}</td>
                      <td>
                        <div className="row wrap">
                          <span className={`badge ${iv.status === "completed" ? "badge-match" : iv.status === "cancelled" ? "badge-neutral" : "badge-semantic"}`}>{iv.status}</span>
                          {iv.conflict_overridden && <span className="badge badge-missing" title="Booked despite a conflict"><AlertTriangle size={11} /> conflict</span>}
                          {iv.has_feedback && <span className="badge badge-primary">feedback</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      ))}
    </div>
  );
}
