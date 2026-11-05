export const PIPELINE = ["submitted", "parsed", "ai_assessed", "recruiter_review", "shortlisted", "interview", "selected"];

export const STATUS = {
  submitted: { label: "Submitted", tone: "neutral" },
  parsed: { label: "Parsed", tone: "neutral" },
  ai_assessed: { label: "AI Assessment Available", tone: "semantic" },
  recruiter_review: { label: "Recruiter Review", tone: "primary" },
  shortlisted: { label: "Shortlisted", tone: "match" },
  interview: { label: "Interview", tone: "semantic" },
  selected: { label: "Selected", tone: "match" },
  rejected: { label: "Rejected", tone: "absent" },
};

export const ACTION_LABELS = {
  recruiter_review: "Start review",
  shortlisted: "Shortlist",
  rejected: "Reject",
  interview: "Move to interview",
  selected: "Select",
};

export const SKILL_STATES = {
  matched: { label: "Matched", tone: "match", help: "Exact evidence found in the resume" },
  semantic: { label: "Semantic match", tone: "semantic", help: "Similar wording found (embedding similarity)" },
  missing_evidence: { label: "Missing evidence", tone: "missing", help: "No evidence in the resume — not proof of absence" },
  confirmed_absent: { label: "Confirmed absent", tone: "absent", help: "A recruiter confirmed this skill is absent" },
};

export const JOB_TYPES = { full_time: "Full-time", part_time: "Part-time", contract: "Contract", internship: "Internship" };
export const INTERVIEW_TYPES = { phone: "Phone", video: "Video", onsite: "On-site", technical: "Technical" };
export const RECOMMENDATIONS = { strong_yes: "Strong yes", yes: "Yes", no: "No", strong_no: "Strong no" };
export const IMPORTANCE = { critical: "Critical", important: "Important", nice: "Nice to have" };

export function formatDate(iso, withTime = false) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, withTime
    ? { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }
    : { day: "numeric", month: "short", year: "numeric" });
}

export function formatSalary(job) {
  const f = (n) => Number(n).toLocaleString();
  return `${job.currency} ${f(job.salary_min)} – ${f(job.salary_max)}`;
}

export const scoreTone = (s) => (s == null ? "neutral" : s >= 75 ? "match" : s >= 50 ? "semantic" : "missing");
