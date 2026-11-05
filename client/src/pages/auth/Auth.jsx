import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  AlertCircle, Briefcase, Check, CircleHelp, Eye, EyeOff, Lock, Mail, Quote, Scale, Sparkles, User, UserCheck,
} from "lucide-react";
import { api, errorMessage } from "../../api/client";
import { homeFor, useAuth } from "../../context/AuthContext";
import "./auth.css";

// Demo accounts are only advertised in local development (or when explicitly enabled for a demo build).
const SHOW_DEMO_ACCOUNTS = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO_ACCOUNTS === "true";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ------------------------------------------------------------------ */
/* Story panel: a single self-playing "receipt" showing how scoring works */
/* ------------------------------------------------------------------ */
// `at` = animation step that highlights the line; lines without it are context, never quoted as evidence.
const LINES = [
  { text: "Py, DRF, Postgres, Flask, Git, Linux", tone: "match", at: 0 },
  { text: "Built backend endpoints with DRF and Postgres for a fintech dashboard", tone: "match", at: 1 },
  { text: "Wrote SQL reports for the finance team" },
  { text: "Containerized services with docker-compose for local and staging", tone: "semantic", at: 2 },
  { text: "Telegram bot that splits group expenses" },
];
const SKILLS = [
  { name: "Python", from: 0, tone: "match", label: "Matched" },
  { name: "Django", from: 1, tone: "match", label: "Matched" },
  { name: "PostgreSQL", from: 1, tone: "match", label: "Matched" },
  { name: "Docker", from: 2, tone: "semantic", label: "Semantic 84%" },
];
const FINAL_STEP = 4;
const FINAL_SCORE = 86;

function useReceiptTimeline() {
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [step, setStep] = useState(reduced ? FINAL_STEP : -1);
  const [score, setScore] = useState(reduced ? FINAL_SCORE : 0);

  useEffect(() => {
    if (reduced) return undefined;
    const timers = [0, 1, 2, 3, 4].map((s) => setTimeout(() => setStep(s), 700 + s * 850));
    return () => timers.forEach(clearTimeout);
  }, [reduced]);

  useEffect(() => {
    if (reduced || step < 0) return undefined;
    const target = step >= 3 ? FINAL_SCORE : [24, 52, 70][step] ?? 0;
    let raf;
    const tick = () => {
      setScore((s) => {
        if (s === target) return s;
        raf = requestAnimationFrame(tick);
        return s + Math.sign(target - s);
      });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step, reduced]);

  return { step, score };
}

function Receipt() {
  const { step, score } = useReceiptTimeline();
  return (
    <div className="ev-receipt" role="img"
      aria-label="Example: three resume lines are highlighted as evidence for Python, Django, PostgreSQL and Docker, producing a score of 86.">
      <div className="ev-paper" aria-hidden="true">
        <div className="ev-paper-head"><span>Resume excerpt</span><span>Software engineer, 2.5 yrs</span></div>
        <div className="ev-paper-name">Bilal Ahmed</div>
        {LINES.map((l, i) => (
          <div key={i} className={`ev-line ${l.tone || ""} ${l.at !== undefined && step >= l.at ? "on" : ""}`}>{l.text}</div>
        ))}
      </div>
      <div className="ev-assess" aria-hidden="true">
        <div className="ev-role"><strong>Backend Developer</strong><span>4 required skills</span></div>
        <div className="ev-skills">
          {SKILLS.map((s) => {
            const on = step >= s.from;
            return (
              <div key={s.name} className={`ev-skill ${on ? s.tone : ""}`}>
                <span>{s.name}</span>
                <span className="ev-state">
                  {on ? (s.tone === "semantic" ? <Sparkles size={12} /> : <Check size={12} />) : <CircleHelp size={12} />}
                  {on ? s.label : "No evidence yet"}
                </span>
              </div>
            );
          })}
        </div>
        <div className="ev-score">
          <div className="ev-score-num">{score}<small>/100</small></div>
          <span className={`ev-ready ${step >= FINAL_STEP ? "on" : ""}`}>Ready for review</span>
        </div>
      </div>
    </div>
  );
}

function StoryPanel() {
  return (
    <aside className="ev-story">
      <Link to="/login" className="ev-brand"><span className="ev-brand-mark">E</span>Evident</Link>
      <div>
        <h1>Every score shows its receipts.</h1>
        <p className="ev-lede">
          Evident matches resumes to roles by meaning, quotes the exact line behind each match, and leaves every
          hiring decision with a person.
        </p>
      </div>
      <Receipt />
      <ul className="ev-facts">
        <li><Quote size={16} /> Each extracted skill is checked against the resume text</li>
        <li><Scale size={16} /> Name, gender, age and contact details are never scored</li>
        <li><UserCheck size={16} /> Recruiters shortlist, reject and hire. The AI only advises</li>
      </ul>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Form building blocks                                                */
/* ------------------------------------------------------------------ */
function Field({ id, label, icon: Icon, error, help, trailing, children }) {
  return (
    <div className="ev-field">
      <label htmlFor={id}>{label}</label>
      <div className="ev-input-wrap">
        <Icon size={17} aria-hidden="true" />
        {children}
        {trailing}
      </div>
      {error ? <span id={`${id}-err`} className="ev-err" role="alert">{error}</span> : help}
    </div>
  );
}

function PasswordInput({ id, value, onChange, error, autoComplete, help, invalid }) {
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const onKey = (e) => setCaps(e.getModifierState?.("CapsLock") || false);
  return (
    <Field id={id} label="Password" icon={Lock} error={error}
      help={caps ? <span className="ev-caps"><AlertCircle size={13} /> Caps Lock is on</span> : help}
      trailing={(
        <button type="button" className="ev-trail" onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}>
          {show ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      )}>
      <input id={id} className="ev-input has-trail" type={show ? "text" : "password"} value={value} autoComplete={autoComplete}
        onChange={onChange} onKeyUp={onKey} onKeyDown={onKey} aria-invalid={!!error || !!invalid}
        aria-describedby={error ? `${id}-err` : undefined} placeholder="••••••••" />
    </Field>
  );
}

function AuthLayout({ top, children }) {
  return (
    <div className="ev-auth">
      <StoryPanel />
      <main className="ev-form-side">
        <div className="ev-form-top">{top}</div>
        <div className="ev-form-wrap">{children}</div>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Log in                                                              */
/* ------------------------------------------------------------------ */
export function Login() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => { document.title = "Log in · Evident"; }, []);
  if (user) return <Navigate to={homeFor(user)} replace />;

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!EMAIL_RE.test(form.email.trim())) errs.email = "Enter a valid email address";
    if (!form.password) errs.password = "Enter your password";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setLoading(true);
    setFormError("");
    try {
      const { data } = await api.post("/auth/login", { ...form, email: form.email.trim() });
      signIn(data);
      const from = location.state?.from;
      navigate(from && from.startsWith(homeFor(data.user)) ? from : homeFor(data.user), { replace: true });
    } catch (err) {
      setFormError(errorMessage(err, "Login failed. Try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout top={<>New to Evident? <Link to="/register">Create an account</Link></>}>
      <form className="ev-form" onSubmit={submit} noValidate>
        <div>
          <h2>Log in</h2>
          <p className="ev-sub">Pick up your review queue or check where your applications stand.</p>
        </div>
        {formError && <div className="ev-alert" role="alert"><AlertCircle size={18} style={{ flex: "none" }} />{formError}</div>}
        <Field id="login-email" label="Email" icon={Mail} error={errors.email}>
          <input id="login-email" className="ev-input" type="email" autoComplete="email" inputMode="email" placeholder="you@company.com"
            value={form.email} aria-invalid={!!errors.email} aria-describedby={errors.email ? "login-email-err" : undefined}
            onChange={(e) => setForm({ ...form, email: e.target.value })} autoFocus />
        </Field>
        <PasswordInput id="login-password" value={form.password} error={errors.password} autoComplete="current-password"
          onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <button type="submit" className="ev-submit" disabled={loading} aria-busy={loading || undefined}>
          {loading ? <><span className="spinner" aria-hidden="true" /> Logging in…</> : <>Log in</>}
        </button>
        <p className="ev-switch only-narrow">Don't have an account? <Link to="/register">Create one</Link></p>
        {SHOW_DEMO_ACCOUNTS && (
          <details className="ev-fine" style={{ textAlign: "left" }}>
            <summary style={{ cursor: "pointer" }}>Demo accounts (local only)</summary>
            <p style={{ marginTop: 6 }}>recruiter@evident.demo, aisha@ / bilal@ / sara@evident.demo. Password Demo@12345</p>
          </details>
        )}
      </form>
    </AuthLayout>
  );
}

/* ------------------------------------------------------------------ */
/* Register                                                            */
/* ------------------------------------------------------------------ */
const ROLES = [
  { id: "recruiter", icon: Briefcase, title: "I'm hiring", text: "Post roles and review evidence-backed shortlists." },
  { id: "candidate", icon: User, title: "I'm job hunting", text: "Upload a resume and track every application." },
];

function passwordRules(pw) {
  return [
    { ok: pw.length >= 8, label: "8+ characters" },
    { ok: /[A-Za-z]/.test(pw), label: "A letter" },
    { ok: /\d/.test(pw), label: "A number" },
  ];
}

export function Register() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "candidate" });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => { document.title = "Create account · Evident"; }, []);
  if (user) return <Navigate to={homeFor(user)} replace />;

  const rules = passwordRules(form.password);
  const passed = rules.filter((r) => r.ok).length;
  const meterColor = passed === 3 ? "#15803d" : passed === 2 ? "#e2b33f" : "#d97706";

  const validate = (f = form) => {
    const errs = {};
    if (f.name.trim().length < 2) errs.name = "Enter your full name (at least 2 characters)";
    if (!EMAIL_RE.test(f.email.trim())) errs.email = "Enter a valid email address";
    if (passwordRules(f.password).some((r) => !r.ok)) errs.password = "Password needs 8+ characters, a letter and a number";
    return errs;
  };
  const blur = (k) => { setTouched((t) => ({ ...t, [k]: true })); setErrors(validate()); };
  const shown = (k) => (touched[k] ? errors[k] : undefined);

  const submit = async (e) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    setTouched({ name: true, email: true, password: true });
    if (Object.keys(errs).length) return;
    setLoading(true);
    setFormError("");
    try {
      const { data } = await api.post("/auth/register", { ...form, name: form.name.trim(), email: form.email.trim() });
      signIn(data);
      navigate(data.user.role === "recruiter" ? "/r" : "/c/profile", { replace: true });
    } catch (err) {
      setFormError(errorMessage(err, "Could not create your account. Try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout top={<>Already have an account? <Link to="/login">Log in</Link></>}>
      <form className="ev-form" onSubmit={submit} noValidate>
        <div>
          <h2>Create your account</h2>
          <p className="ev-sub">Choose the side you're on. It shapes everything you'll see.</p>
        </div>
        {formError && <div className="ev-alert" role="alert"><AlertCircle size={18} style={{ flex: "none" }} />{formError}</div>}

        <fieldset className="ev-roles">
          <legend>I'm here to</legend>
          {ROLES.map(({ id, icon: Icon, title, text }) => (
            <label key={id} className={`ev-role-opt ${form.role === id ? "checked" : ""}`}>
              <input type="radio" name="role" value={id} checked={form.role === id} onChange={() => setForm({ ...form, role: id })} />
              <Check size={16} className="ev-check-tick" aria-hidden="true" />
              <span className="ev-role-icon"><Icon size={17} /></span>
              <strong>{title}</strong>
              <span>{text}</span>
            </label>
          ))}
        </fieldset>

        <Field id="reg-name" label="Full name" icon={User} error={shown("name")}>
          <input id="reg-name" className="ev-input" autoComplete="name" placeholder="Ayesha Siddiqui" value={form.name}
            aria-invalid={!!shown("name")} aria-describedby={shown("name") ? "reg-name-err" : undefined}
            onBlur={() => blur("name")} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field id="reg-email" label={form.role === "recruiter" ? "Work email" : "Email"} icon={Mail} error={shown("email")}>
          <input id="reg-email" className="ev-input" type="email" autoComplete="email" inputMode="email"
            placeholder={form.role === "recruiter" ? "you@company.com" : "you@example.com"} value={form.email}
            aria-invalid={!!shown("email")} aria-describedby={shown("email") ? "reg-email-err" : undefined}
            onBlur={() => blur("email")} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <div onBlur={() => form.password && blur("password")}>
          <PasswordInput id="reg-password" value={form.password} invalid={!!shown("password")} autoComplete="new-password"
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            help={(
              <div className="stack" style={{ gap: 7 }}>
                <div className="ev-meter" aria-hidden="true">
                  {[0, 1, 2].map((i) => <span key={i} style={{ background: i < passed ? meterColor : undefined }} />)}
                </div>
                <ul className="ev-rules" aria-label="Password requirements">
                  {rules.map((r) => (
                    <li key={r.label} className={r.ok ? "ok" : shown("password") ? "bad" : ""}>
                      {r.ok ? <Check size={13} /> : <span aria-hidden="true" style={{ width: 13, textAlign: "center" }}>·</span>}
                      {r.label}<span className="sr-only">{r.ok ? " (met)" : " (not met)"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )} />
        </div>

        <button type="submit" className="ev-submit" disabled={loading} aria-busy={loading || undefined}>
          {loading ? <><span className="spinner" aria-hidden="true" /> Creating account…</> : <>Create account</>}
        </button>
        <p className="ev-switch only-narrow">Already have an account? <Link to="/login">Log in</Link></p>
        <p className="ev-fine">Your name and contact details are never used to score applications.</p>
      </form>
    </AuthLayout>
  );
}
