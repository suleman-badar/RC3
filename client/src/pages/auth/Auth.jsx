import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Check, HelpCircle, Sparkles } from "lucide-react";
import { api, errorMessage } from "../../api/client";
import { Button, Input } from "../../components/ui";
import { homeFor, useAuth } from "../../context/AuthContext";

function BrandPanel() {
  return (
    <aside className="auth-brand">
      <div className="brand" style={{ padding: 0 }}><span className="brand-mark">E</span>Evident</div>
      <div className="stack-lg">
        <h1>Hiring decisions you can trace.</h1>
        <p style={{ maxWidth: 440 }}>
          Semantic matching that shows its receipts. Every score links back to the resume line that earned it, and
          every decision stays with a human.
        </p>
        <div className="demo-receipt" aria-hidden="true">
          <div className="row wrap">
            <span className="chip chip-matched"><Check size={13} /> Python</span>
            <span className="chip chip-semantic"><Sparkles size={13} /> Docker <span className="small">84%</span></span>
            <span className="chip chip-missing_evidence"><HelpCircle size={13} /> Kubernetes</span>
          </div>
          <blockquote className="evidence" style={{ margin: 0 }}>
            “Containerized services with docker-compose for local and staging environments”
            <span className="src">Resume · experience</span>
          </blockquote>
        </div>
      </div>
      <span className="small" style={{ opacity: 0.7 }}>AI assists. Recruiters decide.</span>
    </aside>
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function Login() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  if (user) return <Navigate to={homeFor(user)} replace />;

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!EMAIL_RE.test(form.email)) errs.email = "Enter a valid email address";
    if (!form.password) errs.password = "Enter your password";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setLoading(true);
    setFormError("");
    try {
      const { data } = await api.post("/auth/login", form);
      signIn(data);
      const from = location.state?.from;
      navigate(from && from.startsWith(homeFor(data.user)) ? from : homeFor(data.user), { replace: true });
    } catch (err) {
      setFormError(errorMessage(err, "Login failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth">
      <BrandPanel />
      <main className="auth-form">
        <form className="auth-card stack-lg" onSubmit={submit} noValidate>
          <div className="stack" style={{ gap: 4 }}>
            <h1>Welcome back</h1>
            <p className="muted">Log in to your recruiter or candidate account.</p>
          </div>
          {formError && <div className="alert alert-error" role="alert">{formError}</div>}
          <Input label="Email" type="email" autoComplete="email" value={form.email} error={errors.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Password" type="password" autoComplete="current-password" value={form.password} error={errors.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <Button type="submit" loading={loading}>Log in</Button>
          <p className="muted">No account? <Link to="/register">Create one</Link></p>
          <details className="small muted">
            <summary style={{ cursor: "pointer" }}>Demo accounts</summary>
            <p style={{ marginTop: 6 }}>recruiter@evident.demo · aisha@ / bilal@ / sara@evident.demo — password Demo@12345</p>
          </details>
        </form>
      </main>
    </div>
  );
}

export function Register() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "candidate" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  if (user) return <Navigate to={homeFor(user)} replace />;

  const validate = () => {
    const errs = {};
    if (form.name.trim().length < 2) errs.name = "Name must be at least 2 characters";
    if (!EMAIL_RE.test(form.email)) errs.email = "Enter a valid email address";
    if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password))
      errs.password = "At least 8 characters, including a letter and a number";
    return errs;
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setLoading(true);
    setFormError("");
    try {
      const { data } = await api.post("/auth/register", form);
      signIn(data);
      navigate(data.user.role === "recruiter" ? "/r" : "/c/profile", { replace: true });
    } catch (err) {
      setFormError(errorMessage(err, "Registration failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth">
      <BrandPanel />
      <main className="auth-form">
        <form className="auth-card stack-lg" onSubmit={submit} noValidate>
          <div className="stack" style={{ gap: 4 }}>
            <h1>Create your account</h1>
            <p className="muted">Choose how you'll use Evident.</p>
          </div>
          <div className="segmented" role="group" aria-label="Account type">
            {["candidate", "recruiter"].map((r) => (
              <button type="button" key={r} aria-pressed={form.role === r} onClick={() => setForm({ ...form, role: r })}>
                {r === "candidate" ? "I'm a candidate" : "I'm a recruiter"}
              </button>
            ))}
          </div>
          {formError && <div className="alert alert-error" role="alert">{formError}</div>}
          <Input label="Full name" autoComplete="name" value={form.name} error={errors.name}
            onBlur={() => setErrors(validate())} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Email" type="email" autoComplete="email" value={form.email} error={errors.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Password" type="password" autoComplete="new-password" value={form.password} error={errors.password}
            hint="At least 8 characters, including a letter and a number"
            onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <Button type="submit" loading={loading}>Create account</Button>
          <p className="muted">Already registered? <Link to="/login">Log in</Link></p>
        </form>
      </main>
    </div>
  );
}
