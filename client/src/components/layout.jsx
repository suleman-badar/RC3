import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Bell, Briefcase, CalendarClock, FileText, Inbox, LayoutDashboard, ListChecks, LogOut, Menu, Search } from "lucide-react";
import { api } from "../api/client";
import { useNotifications } from "../api/queries";
import { homeFor, useAuth } from "../context/AuthContext";
import { formatDate } from "../lib/status";
import { PageSkeleton } from "./ui";
import { useQueryClient } from "@tanstack/react-query";

const TITLES = [
  [/^\/r\/?$/, "Dashboard"], [/^\/r\/jobs\/new$/, "Post a job"], [/^\/r\/jobs\/[^/]+\/edit$/, "Edit job"],
  [/^\/r\/jobs\/[^/]+$/, "Applicants"], [/^\/r\/jobs/, "Jobs"], [/^\/r\/applications\/?$/, "Applications"], [/^\/r\/applications/, "Candidate review"],
  [/^\/r\/interviews/, "Interviews"], [/^\/r\/search/, "Talent search"], [/^\/r\/compare/, "Compare candidates"],
  [/^\/c\/?$/, "My applications"], [/^\/c\/jobs/, "Jobs"], [/^\/c\/profile/, "Profile & resume"],
];
export const titleFor = (path) => TITLES.find(([re]) => re.test(path))?.[1] || "Evident";

function usePageTitle() {
  const { pathname } = useLocation();
  const title = titleFor(pathname);
  useEffect(() => { document.title = `${title} · Evident`; }, [title]);
  return title;
}

export function ProtectedRoute({ role }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageSkeleton />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (role && user.role !== role) return <Navigate to={homeFor(user)} replace />;
  return <Outlet />;
}

function NotificationBell() {
  const { data = [] } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const unread = data.filter((n) => !n.read).length;

  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const markAll = async () => {
    await api.post("/notifications/read-all");
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };
  const openItem = async (n) => {
    if (!n.read) await api.patch(`/notifications/${n.id}/read`).catch(() => {});
    qc.invalidateQueries({ queryKey: ["notifications"] });
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="bell" ref={ref}>
      <button className="btn btn-ghost btn-icon" aria-label={`Notifications (${unread} unread)`} onClick={() => setOpen((o) => !o)}>
        <Bell size={18} />
        {unread > 0 && <span className="count">{unread}</span>}
      </button>
      {open && (
        <div className="dropdown" role="menu">
          <div className="row between" style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)" }}>
            <strong>Notifications</strong>
            {unread > 0 && <button className="btn btn-ghost btn-sm" onClick={markAll}>Mark all read</button>}
          </div>
          {data.length === 0 && <div className="item muted">You're all caught up.</div>}
          {data.map((n) => (
            <div key={n.id} className={`item ${n.read ? "" : "unread"}`} role="menuitem" tabIndex={0}
              style={{ cursor: "pointer" }} onClick={() => openItem(n)} onKeyDown={(e) => e.key === "Enter" && openItem(n)}>
              <div>{n.message}</div>
              <div className="small muted">{formatDate(n.created_at, true)}</div>
            </div>
          ))}
          <div className="small muted" style={{ padding: "8px 14px" }}>Notifications are simulated in-app (no email is sent).</div>
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="row">
      <span className="hide-mobile small muted">{user?.name} · {user?.role}</span>
      <NotificationBell />
      <button className="btn btn-ghost btn-sm" onClick={async () => { await logout(); navigate("/login"); }}>
        <LogOut size={16} /> <span className="hide-mobile">Log out</span>
      </button>
    </div>
  );
}

export function RecruiterShell() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const title = usePageTitle();
  useEffect(() => setOpen(false), [location.pathname]);
  const links = [
    { to: "/r", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/r/jobs", label: "Jobs", icon: Briefcase },
    { to: "/r/applications", label: "Applications", icon: Inbox },
    { to: "/r/interviews", label: "Interviews", icon: CalendarClock },
    { to: "/r/search", label: "Talent search", icon: Search },
  ];
  return (
    <div className="shell">
      <div className={`drawer-backdrop ${open ? "open" : ""}`} onClick={() => setOpen(false)} />
      <nav className={`sidebar ${open ? "open" : ""}`} aria-label="Main">
        <Link to="/r" className="brand" style={{ textDecoration: "none" }}>
          <span className="brand-mark">E</span><span className="nav-text">Evident</span>
        </Link>
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`} title={label}>
            <Icon size={20} /><span className="nav-text">{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="main">
        <header className="topbar">
          <button className="btn btn-ghost btn-icon menu-btn" aria-label="Open menu" onClick={() => setOpen(true)}><Menu size={20} /></button>
          <div className="row grow" style={{ gap: 10, minWidth: 0 }}>
            <span className="topbar-title">{title}</span>
            <span className="small muted hide-mobile hide-tablet">· AI assists, you decide</span>
          </div>
          <UserMenu />
        </header>
        <Outlet />
      </div>
    </div>
  );
}

export function CandidateShell() {
  usePageTitle();
  const links = [
    { to: "/c", label: "My applications", icon: ListChecks, end: true },
    { to: "/c/jobs", label: "Jobs", icon: Briefcase },
    { to: "/c/profile", label: "Profile & resume", icon: FileText },
  ];
  return (
    <div className="main" style={{ minHeight: "100%" }}>
      <header className="topbar">
        <div className="row" style={{ gap: 16 }}>
          <Link to="/c" className="row" style={{ textDecoration: "none", color: "var(--ink)", fontWeight: 700 }}>
            <span className="brand-mark">E</span><span className="hide-mobile">Evident</span>
          </Link>
          <nav className="topnav" aria-label="Main">
            {links.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? "active" : "")} title={label}>
                <span className="row" style={{ gap: 6 }}><Icon size={16} /><span className="nav-text">{label}</span></span>
              </NavLink>
            ))}
          </nav>
        </div>
        <UserMenu />
      </header>
      <Outlet />
    </div>
  );
}
