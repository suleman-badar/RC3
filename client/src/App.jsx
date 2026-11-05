import { Navigate, Route, Routes } from "react-router-dom";
import { CandidateShell, ProtectedRoute, RecruiterShell } from "./components/layout";
import { homeFor, useAuth } from "./context/AuthContext";
import { Login, Register } from "./pages/auth/Auth";
import CandidateDashboard from "./pages/candidate/Dashboard";
import CandidateProfile from "./pages/candidate/Profile";
import CandidateJobs from "./pages/candidate/Jobs";
import CandidateJobDetail from "./pages/candidate/JobDetail";
import RecruiterDashboard from "./pages/recruiter/Dashboard";
import RecruiterJobs from "./pages/recruiter/Jobs";
import JobForm from "./pages/recruiter/JobForm";
import JobApplicants from "./pages/recruiter/JobApplicants";
import ApplicationDetail from "./pages/recruiter/ApplicationDetail";
import Applications from "./pages/recruiter/Applications";
import Interviews from "./pages/recruiter/Interviews";
import TalentSearch from "./pages/recruiter/TalentSearch";
import Compare from "./pages/recruiter/Compare";
import { EmptyState, PageSkeleton } from "./components/ui";
import { Link } from "react-router-dom";

function Home() {
  const { user, loading } = useAuth();
  if (loading) return <PageSkeleton />;
  return <Navigate to={user ? homeFor(user) : "/login"} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route element={<ProtectedRoute role="candidate" />}>
        <Route path="/c" element={<CandidateShell />}>
          <Route index element={<CandidateDashboard />} />
          <Route path="profile" element={<CandidateProfile />} />
          <Route path="jobs" element={<CandidateJobs />} />
          <Route path="jobs/:id" element={<CandidateJobDetail />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute role="recruiter" />}>
        <Route path="/r" element={<RecruiterShell />}>
          <Route index element={<RecruiterDashboard />} />
          <Route path="jobs" element={<RecruiterJobs />} />
          <Route path="jobs/new" element={<JobForm />} />
          <Route path="jobs/:id/edit" element={<JobForm />} />
          <Route path="jobs/:id" element={<JobApplicants />} />
          <Route path="applications" element={<Applications />} />
          <Route path="applications/:id" element={<ApplicationDetail />} />
          <Route path="interviews" element={<Interviews />} />
          <Route path="search" element={<TalentSearch />} />
          <Route path="compare" element={<Compare />} />
        </Route>
      </Route>

      <Route path="*" element={<div className="page"><EmptyState title="Page not found" action={<Link to="/">Go home</Link>} /></div>} />
    </Routes>
  );
}
