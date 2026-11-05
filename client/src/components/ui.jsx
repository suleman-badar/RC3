import { useEffect, useId, useRef, useState } from "react";
import { AlertTriangle, Check, CircleSlash, Inbox, RefreshCw, Sparkles, X, HelpCircle } from "lucide-react";
import { PIPELINE, SKILL_STATES, STATUS, formatDate } from "../lib/status";

export function Button({ variant = "primary", size, loading, children, className = "", ...props }) {
  return (
    <button
      className={`btn btn-${variant} ${size === "sm" ? "btn-sm" : ""} ${className}`}
      disabled={loading || props.disabled}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <span className="spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function Field({ label, error, hint, children, htmlFor }) {
  return (
    <div className="field">
      {label && <label htmlFor={htmlFor}>{label}</label>}
      {children}
      {error ? <span className="error-text" role="alert">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

export function Input({ label, error, hint, id, ...props }) {
  const auto = useId();
  const fid = id || auto;
  return (
    <Field label={label} error={error} hint={hint} htmlFor={fid}>
      <input id={fid} className="input" aria-invalid={!!error} {...props} />
    </Field>
  );
}

export function Textarea({ label, error, hint, id, ...props }) {
  const auto = useId();
  const fid = id || auto;
  return (
    <Field label={label} error={error} hint={hint} htmlFor={fid}>
      <textarea id={fid} className="textarea" aria-invalid={!!error} {...props} />
    </Field>
  );
}

export function Select({ label, error, hint, id, options, ...props }) {
  const auto = useId();
  const fid = id || auto;
  return (
    <Field label={label} error={error} hint={hint} htmlFor={fid}>
      <select id={fid} className="select" aria-invalid={!!error} {...props}>
        {Object.entries(options).map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </Field>
  );
}

export function Card({ children, className = "", ...props }) {
  return <div className={`card ${className}`} {...props}>{children}</div>;
}

export function Modal({ open, title, onClose, children, footer, wide }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement;
    const onKey = (e) => {
      if (e.key === "Escape") closeRef.current?.();
      if (e.key === "Tab" && ref.current) {
        const els = ref.current.querySelectorAll("button, input, select, textarea, a[href], [tabindex]:not([tabindex='-1'])");
        if (!els.length) return;
        const first = els[0];
        const last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    setTimeout(() => ref.current?.querySelector("input, select, textarea, button")?.focus(), 0);
    return () => { document.removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, [open]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${wide ? "modal-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close dialog"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Skeleton({ height = 16, width = "100%", style }) {
  return <div className="skeleton" style={{ height, width, ...style }} aria-hidden="true" />;
}

export function PageSkeleton() {
  return (
    <div className="page" aria-busy="true" aria-label="Loading">
      <Skeleton height={28} width={260} />
      <div className="grid grid-3">
        <Skeleton height={110} /><Skeleton height={110} /><Skeleton height={110} />
      </div>
      <Skeleton height={280} />
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, text, action }) {
  return (
    <div className="empty">
      <div className="icon"><Icon size={22} /></div>
      <h3>{title}</h3>
      {text && <p className="muted" style={{ maxWidth: 420 }}>{text}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message = "Something went wrong.", onRetry }) {
  return (
    <div className="alert alert-error" role="alert">
      <AlertTriangle size={18} style={{ flex: "none", marginTop: 1 }} />
      <div className="grow">{message}</div>
      {onRetry && <Button variant="secondary" size="sm" onClick={onRetry}><RefreshCw size={14} /> Retry</Button>}
    </div>
  );
}

export function StatusBadge({ status }) {
  const s = STATUS[status] || { label: status, tone: "neutral" };
  return <span className={`badge badge-${s.tone}`}>{s.label}</span>;
}

const STATE_ICON = { matched: Check, semantic: Sparkles, missing_evidence: HelpCircle, confirmed_absent: CircleSlash };

export function SkillChip({ name, state, similarity, onClick, pressed, required }) {
  const Icon = state ? STATE_ICON[state] : null;
  const meta = SKILL_STATES[state];
  const content = (
    <>
      {Icon && <Icon size={13} aria-hidden="true" />}
      <span>{name}</span>
      {state === "semantic" && similarity != null && <span className="small num">{Math.round(similarity * 100)}%</span>}
      {required === false && <span className="small" style={{ opacity: 0.75 }}>· pref</span>}
      {meta && <span className="sr-only">({meta.label})</span>}
    </>
  );
  const cls = `chip ${state ? `chip-${state}` : ""}`;
  if (onClick) {
    return <button type="button" className={cls} onClick={onClick} aria-pressed={pressed} title={meta?.help}>{content}</button>;
  }
  return <span className={cls} title={meta?.help}>{content}</span>;
}

export function SkillLegend() {
  return (
    <div className="row wrap small">
      {Object.entries(SKILL_STATES).map(([k, v]) => (
        <SkillChip key={k} name={v.label} state={k} />
      ))}
    </div>
  );
}

export function EvidenceQuote({ text, source, unverified }) {
  if (!text) return null;
  return (
    <blockquote className={`evidence ${unverified ? "unverified" : ""}`} style={{ margin: 0 }}>
      “{text}”
      <span className="src">
        {unverified ? "⚠ Not found in resume — needs manual review" : source ? `Resume · ${source}` : "Resume"}
      </span>
    </blockquote>
  );
}

export function VerifiedMark({ verified }) {
  if (verified) return null;
  return (
    <span className="badge badge-absent" title="This claim could not be matched to the resume text">
      <AlertTriangle size={12} /> Needs review
    </span>
  );
}

export function ScoreRing({ value, size = 96, stroke = 9, label }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setShown(value ?? 0), 50);
    return () => clearTimeout(t);
  }, [value]);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = value == null ? "#c9c6bd" : value >= 75 ? "#15803d" : value >= 50 ? "#1d4ed8" : "#b45309";
  return (
    <div className="score-ring" style={{ width: size, height: size }} role="img" aria-label={`${label || "Score"} ${value ?? "not available"} out of 100`}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eeede8" strokeWidth={stroke} />
        <circle className="fg" cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * shown) / 100} />
      </svg>
      <span className="value" style={{ fontSize: size > 70 ? 28 : 15 }}>{value ?? "—"}</span>
    </div>
  );
}

const PART_LABEL = { skills: "Skills", experience: "Experience", projects: "Project relevance", qualifications: "Qualifications" };
const PART_COLOR = { skills: "#0e6e64", experience: "#1d4ed8", projects: "#b45309", qualifications: "#7c3aed" };

export function ScoreBreakdown({ breakdown }) {
  if (!breakdown) return null;
  return (
    <div className="stack">
      {Object.entries(breakdown).map(([k, v]) => (
        <div key={k} className="stack" style={{ gap: 4 }}>
          <div className="row between">
            <span style={{ fontWeight: 500 }}>{PART_LABEL[k]} <span className="muted small">· weight {Math.round(v.weight * 100)}%</span></span>
            <span className="num"><strong>{v.score}</strong><span className="muted">/100 → {v.weighted.toFixed(1)} pts</span></span>
          </div>
          <div className="bar"><span style={{ width: `${v.score}%`, background: PART_COLOR[k] }} /></div>
          <span className="small muted">{v.explanation}</span>
        </div>
      ))}
    </div>
  );
}

export function MiniBreakdown({ breakdown }) {
  if (!breakdown) return <span className="muted small">—</span>;
  return (
    <div className="minibar" title={Object.entries(breakdown).map(([k, v]) => `${PART_LABEL[k]}: ${v.score}`).join(" · ")}>
      {Object.entries(breakdown).map(([k, v]) => (
        <span key={k} style={{ width: `${v.weighted}%`, background: PART_COLOR[k] }} />
      ))}
    </div>
  );
}

export function StatusTimeline({ status, history = [] }) {
  const rejected = status === "rejected";
  const reachedIdx = Math.max(...history.map((h) => PIPELINE.indexOf(h.to)), PIPELINE.indexOf(status), 0);
  const dateFor = (s) => history.find((h) => h.to === s)?.at;
  return (
    <div className="steps" aria-label="Application progress">
      {PIPELINE.map((s, i) => {
        const done = i < reachedIdx || (i === reachedIdx && status === "selected");
        const current = !rejected && i === reachedIdx && status !== "selected";
        return (
          <div key={s} className={`step ${done ? "done" : ""} ${current ? "current" : ""}`}>
            <span className="dot">{done && <Check size={12} />}</span>
            <span>{STATUS[s].label}</span>
            {dateFor(s) && <span className="small">{formatDate(dateFor(s))}</span>}
          </div>
        );
      })}
      {rejected && (
        <div className="step rejected current">
          <span className="dot"><X size={12} /></span>
          <span>Rejected</span>
          {dateFor("rejected") && <span className="small">{formatDate(dateFor("rejected"))}</span>}
        </div>
      )}
    </div>
  );
}

export function AuditTimeline({ history = [] }) {
  return (
    <ol className="audit">
      {[...history].reverse().map((h, i) => (
        <li key={i}>
          <span className="pip" />
          <div className="stack" style={{ gap: 2 }}>
            <span>
              {h.from ? <><StatusBadge status={h.from} /> → </> : null}<StatusBadge status={h.to} />
            </span>
            <span className="small muted">
              {h.by_name || "System"} {h.by_role && h.by_role !== "system" ? `(${h.by_role})` : ""} · {formatDate(h.at, true)}
            </span>
            {h.note && <span className="small">{h.note}</span>}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function StatCard({ label, value, icon: Icon, hint }) {
  return (
    <Card className="card-tight">
      <div className="row between">
        <span className="label">{label}</span>
        {Icon && <Icon size={18} className="muted" />}
      </div>
      <div className="num" style={{ fontSize: 28, fontWeight: 600, lineHeight: "36px", marginTop: 6 }}>{value}</div>
      {hint && <div className="small muted">{hint}</div>}
    </Card>
  );
}
