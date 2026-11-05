import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  AlertCircle, AlertTriangle, Briefcase, Check, CircleHelp, Eye, EyeOff, Lock, Mail, Quote, Scale, ShieldCheck,
  Sparkles, User, UserCheck,
} from "lucide-react";
import { api, errorMessage } from "../../api/client";
import { homeFor, useAuth } from "../../context/AuthContext";
import "./auth.css";

// Demo accounts are only advertised in local development (or when explicitly enabled for a demo build).
const SHOW_DEMO_ACCOUNTS = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO_ACCOUNTS === "true";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/* =================================================================== */
/* Product scene: resume lines → evidence links → skills → score       */
/* Drawn on a fixed 610×450 canvas and scaled to fit, so links line up. */
/* =================================================================== */
const W = 610;
const H = 450;
const LINE_TOP = [100, 146, 192, 238, 284];                 // inside the sheet (sheet top = 20)
const CHIP_TOP = [64, 108, 152, 196];                      // inside the card (card top = 80)
const lineY = (i) => 20 + LINE_TOP[i] + 18;
const chipY = (i) => 80 + CHIP_TOP[i] + 18;

const LINES = [
  { text: "Py, DRF, Postgres, Flask, Git, Linux", tone: "match", at: 0 },
  { text: "Built REST APIs with DRF on Postgres", tone: "match", at: 1 },
  { text: "Wrote SQL reports for the finance team" },
  { text: "Shipped services with docker-compose", tone: "semantic", at: 2 },
  { text: "Telegram bot that splits group expenses" },
];
const SKILLS = [
  { name: "Python", at: 0, tone: "match", label: "Matched" },
  { name: "Django", at: 1, tone: "match", label: "Via DRF" },
  { name: "PostgreSQL", at: 1, tone: "match", label: "Matched" },
  { name: "Docker", at: 2, tone: "semantic", label: "Semantic 84%" },
];
const LINKS = [
  { from: 0, to: 0, at: 0, color: "#22a35a" },
  { from: 1, to: 1, at: 1, color: "#22a35a" },
  { from: 1, to: 2, at: 1, color: "#22a35a" },
  { from: 3, to: 3, at: 2, color: "#5b83f0" },
];
const SCORE = 86;
const LAST_STEP = 5;

function useTimeline() {
  const reduced = prefersReducedMotion();
  const [step, setStep] = useState(reduced ? LAST_STEP : -1);
  const [score, setScore] = useState(reduced ? SCORE : 0);
  useEffect(() => {
    if (reduced) return undefined;
    const t = [0, 1, 2, 3, 4, 5].map((s) => setTimeout(() => setStep(s), 650 + s * 780));
    return () => t.forEach(clearTimeout);
  }, [reduced]);
  useEffect(() => {
    if (reduced || step < 3) return undefined;
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / 1200);
      setScore(Math.round(SCORE * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step >= 3, reduced]); // eslint-disable-line react-hooks/exhaustive-deps
  return { step, score };
}

function Scene() {
  const { step, score } = useTimeline();
  const boxRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setScale(Math.min(1.05, e.contentRect.width / W)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (prefersReducedMotion() || !window.matchMedia?.("(pointer: fine)").matches) return undefined;
    const onMove = (e) => {
      const x = e.clientX / window.innerWidth - 0.5;
      const y = e.clientY / window.innerHeight - 0.5;
      setTilt({ x: -y * 6, y: x * 8 });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <div className="ev-scene-wrap">
      <div className="ev-scene-box" ref={boxRef} style={{ height: H * scale }}
        role="img" aria-label="Animated example: resume lines are linked as evidence to Python, Django, PostgreSQL and Docker, giving a score of 86. An unsupported Kubernetes claim is flagged and a fairness check passes.">
        <div className="ev-tilt" style={{ transform: `rotateX(${10 + tilt.x}deg) rotateY(${-18 + tilt.y}deg) rotateZ(2deg)` }}>
          <div className="ev-bob">
          <div className="ev-scene" style={{ transform: `scale(${scale * 0.92})` }} aria-hidden="true">
            <div className="ev-sheet">
              <div className="ev-sheet-head"><span>Resume</span><span>bilal_ahmed.pdf</span></div>
              <div className="ev-sheet-name">Bilal Ahmed</div>
              <div className="ev-sheet-role">Software engineer, 2.5 years</div>
              {LINES.map((l, i) => (
                <div key={i} style={{ top: LINE_TOP[i] }}
                  className={`ev-line ${l.tone ? `ev ${l.tone}` : ""} ${l.at !== undefined && step >= l.at ? "on" : ""}`}>
                  {l.text}
                </div>
              ))}
            </div>

            <svg className="ev-links" viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
              {LINKS.map((k, i) => {
                const y1 = lineY(k.from);
                const y2 = chipY(k.to);
                const on = step >= k.at ? "on" : "";
                return (
                  <g key={i}>
                    <path className={on} stroke={k.color} d={`M318 ${y1} C 347 ${y1}, 347 ${y2}, 376 ${y2}`} />
                    <circle className={on} cx="318" cy={y1} r="3" fill={k.color} />
                  </g>
                );
              })}
            </svg>

            <div className="ev-card">
              <div className="ev-card-title">Backend Developer</div>
              <div className="ev-card-sub">4 required skills</div>
              {SKILLS.map((s, i) => {
                const on = step >= s.at;
                return (
                  <div key={s.name} style={{ top: CHIP_TOP[i] }} className={`ev-chip ${on ? s.tone : ""}`}>
                    <span>{s.name}</span>
                    <span className="st">
                      {on ? (s.tone === "semantic" ? <Sparkles size={12} /> : <Check size={12} />) : <CircleHelp size={12} />}
                      {on ? s.label : "No evidence yet"}
                    </span>
                  </div>
                );
              })}
              <div className="ev-score">
                <div className="ev-ring">
                  <svg width="52" height="52">
                    <circle cx="26" cy="26" r={r} fill="none" stroke="#eeede8" strokeWidth="5" />
                    <circle className="fg" cx="26" cy="26" r={r} fill="none" stroke="#15803d" strokeWidth="5" strokeLinecap="round"
                      strokeDasharray={c} strokeDashoffset={c - (c * (step >= 3 ? SCORE : 0)) / 100} />
                  </svg>
                  <b>{score}</b>
                </div>
                <div className="ev-score-txt"><strong>Ready for review</strong>Every point cites a line</div>
              </div>
            </div>

            <div className={`ev-float flag ${step >= 4 ? "on" : ""}`}>
              <span className="ic"><AlertTriangle size={15} /></span>
              <div><strong>“Kubernetes” not found in resume</strong><small>Flagged for review, not scored</small></div>
            </div>
            <div className={`ev-float fair ${step >= 5 ? "on" : ""}`}>
              <span className="ic"><ShieldCheck size={15} /></span>
              <div><strong>Fairness check passed</strong><small>Changed name, gender, age: Δ 0</small></div>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stage() {
  return (
    <aside className="ev-stage">
      <span className="ev-glow a" /><span className="ev-glow b" />
      <Link to="/login" className="ev-brand"><span className="ev-brand-mark">E</span>Evident</Link>
      <div className="ev-headline">
        <h1>Hire on evidence.</h1>
        <p>Evident matches resumes to roles by meaning, links every score to the exact line behind it, and leaves each hiring decision with a person.</p>
      </div>
      <Scene />
      <ul className="ev-facts">
        <li><Quote size={15} /> Claims verified against the resume</li>
        <li><Scale size={15} /> Personal details never scored</li>
        <li><UserCheck size={15} /> Recruiters make every decision</li>
      </ul>
    </aside>
  );
}

/* =================================================================== */
/* Form pieces                                                          */
/* =================================================================== */
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

function PasswordInput({ id, value, onChange, error, invalid, autoComplete, help }) {
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
        aria-describedby={error ? `${id}-err` : undefined} placeholder="Enter your password" />
    </Field>
  );
}

function SubmitButton({ loading, idle, busy }) {
  return (
    <button type="submit" className="ev-submit" disabled={loading} aria-busy={loading || undefined}>
      {loading ? <><span className="spinner" aria-hidden="true" /> {busy}</> : idle}
    </button>
  );
}

/* =================================================================== */
/* Log in                                                               */
/* =================================================================== */
function LoginForm() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

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
    <form className="ev-form" onSubmit={submit} noValidate>
      <div>
        <h2>Welcome back</h2>
        <p className="ev-sub">Log in to your review queue, or check where your applications stand.</p>
      </div>
      {formError && <div className="ev-alert" role="alert"><AlertCircle size={18} style={{ flex: "none" }} />{formError}</div>}
      <Field id="login-email" label="Email" icon={Mail} error={errors.email}>
        <input id="login-email" className="ev-input" type="email" autoComplete="email" inputMode="email" placeholder="you@company.com"
          value={form.email} aria-invalid={!!errors.email} aria-describedby={errors.email ? "login-email-err" : undefined}
          onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </Field>
      <PasswordInput id="login-password" value={form.password} error={errors.password} autoComplete="current-password"
        onChange={(e) => setForm({ ...form, password: e.target.value })} />
      <SubmitButton loading={loading} idle="Log in" busy="Logging in…" />
      {SHOW_DEMO_ACCOUNTS && (
        <details className="ev-fine" style={{ textAlign: "left" }}>
          <summary style={{ cursor: "pointer" }}>Demo accounts (local only)</summary>
          <p style={{ marginTop: 6 }}>recruiter@evident.demo, aisha@ / bilal@ / sara@evident.demo. Password Demo@12345</p>
        </details>
      )}
    </form>
  );
}

/* =================================================================== */
/* Create account                                                       */
/* =================================================================== */
const ROLES = [
  { id: "recruiter", icon: Briefcase, title: "I'm hiring", text: "Post roles and review evidence-backed shortlists." },
  { id: "candidate", icon: User, title: "I'm job hunting", text: "Upload a resume and track every application." },
];
const passwordRules = (pw) => [
  { ok: pw.length >= 8, label: "8+ characters" },
  { ok: /[A-Za-z]/.test(pw), label: "A letter" },
  { ok: /\d/.test(pw), label: "A number" },
];

function RegisterForm() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "candidate" });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  const rules = passwordRules(form.password);
  const passed = rules.filter((r) => r.ok).length;
  const meterColor = passed === 3 ? "#15803d" : passed === 2 ? "#e2b33f" : "#d97706";
  const validate = (f = form) => {
    const errs = {};
    if (f.name.trim().length < 2) errs.name = "Enter your full name (at least 2 characters)";
    if (!EMAIL_RE.test(f.email.trim())) errs.email = "Enter a valid email address";
    if (passwordRules(f.password).some((r) => !r.ok)) errs.password = "Password doesn't meet the requirements";
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
            <span className="tick" aria-hidden="true">{form.role === id && <Check size={12} strokeWidth={3} />}</span>
            <span className="ri"><Icon size={17} /></span>
            <strong>{title}</strong>
            <span className="d">{text}</span>
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
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
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
      <SubmitButton loading={loading} idle="Create account" busy="Creating account…" />
      <p className="ev-fine">Your name and contact details are never used to score applications.</p>
    </form>
  );
}

/* =================================================================== */
/* Shared page: one component for both routes so the stage never replays */
/* =================================================================== */
function AuthPage() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const isRegister = pathname.startsWith("/register");
  useEffect(() => { document.title = `${isRegister ? "Create account" : "Log in"} · Evident`; }, [isRegister]);
  if (user) return <Navigate to={homeFor(user)} replace />;

  return (
    <div className="ev-auth">
      <Stage />
      <main className="ev-side">
        <div className="ev-panel">
          <nav className={`ev-tabs ${isRegister ? "reg" : ""}`} aria-label="Account">
            <span className="pill" aria-hidden="true" />
            <Link to="/login" replace aria-current={!isRegister ? "page" : undefined}>Log in</Link>
            <Link to="/register" replace aria-current={isRegister ? "page" : undefined}>Create account</Link>
          </nav>
          {isRegister ? <RegisterForm key="r" /> : <LoginForm key="l" />}
        </div>
        <div className="ev-below">
          <span><ShieldCheck size={14} /> Passwords are hashed with bcrypt</span>
          <span><Scale size={14} /> AI advises, people decide</span>
        </div>
      </main>
    </div>
  );
}

export const Login = AuthPage;
export const Register = AuthPage;
