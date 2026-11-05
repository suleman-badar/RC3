import { CalendarPlus, Clock, ExternalLink, MapPin, Video } from "lucide-react";
import { INTERVIEW_TYPES } from "../lib/status";

const isUrl = (v) => /^https?:\/\//i.test(v || "");
const icsDate = (iso) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (t) => String(t || "").replace(/[\\,;]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");

/** Download an .ics file so the candidate can add the interview to any calendar app. */
function downloadIcs(iv, jobTitle) {
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Evident//Interview//EN", "BEGIN:VEVENT",
    `UID:${icsDate(iv.start)}-${Math.random().toString(36).slice(2)}@evident`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(iv.start)}`, `DTEND:${icsDate(iv.end)}`,
    `SUMMARY:${esc(`${INTERVIEW_TYPES[iv.type] || "Interview"} interview: ${jobTitle}`)}`,
    iv.location_or_link ? `LOCATION:${esc(iv.location_or_link)}` : null,
    "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean);
  const url = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/calendar" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: "interview.ics" });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Candidate-facing interview details: when, how long, which format and where to join. */
export default function InterviewPanel({ interview: iv, jobTitle }) {
  if (!iv) return null;
  const start = new Date(iv.start);
  const end = new Date(iv.end);
  const past = iv.status !== "scheduled" || end < new Date();
  const time = (d) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const heading = iv.status === "completed" ? "Interview completed"
    : iv.status === "cancelled" ? "Interview cancelled"
      : past ? "Interview time has passed" : "Your interview is scheduled";
  return (
    <div className={`iv-panel ${past ? "past" : ""}`} aria-label="Interview details">
      <div className="iv-date" aria-hidden="true">
        <span className="m">{start.toLocaleDateString(undefined, { month: "short" })}</span>
        <span className="d">{start.getDate()}</span>
        <span className="w">{start.toLocaleDateString(undefined, { weekday: "short" })}</span>
      </div>
      <div style={{ minWidth: 0 }}>
        <strong>{heading}</strong>
        <div className="meta">
          <span><Clock size={14} /> {start.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}, {time(start)} to {time(end)}</span>
          <span><Video size={14} /> {INTERVIEW_TYPES[iv.type] || "Interview"}, {iv.duration_min} min</span>
          {iv.location_or_link && (isUrl(iv.location_or_link)
            ? <span><ExternalLink size={14} /> <a href={iv.location_or_link} target="_blank" rel="noreferrer">Join link</a></span>
            : <span><MapPin size={14} /> {iv.location_or_link}</span>)}
        </div>
      </div>
      {!past && (
        <div className="iv-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => downloadIcs(iv, jobTitle)}>
            <CalendarPlus size={15} /> Add to calendar
          </button>
        </div>
      )}
    </div>
  );
}
