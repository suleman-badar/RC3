import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: (count, err) => count < 1 && !(err?.response?.status < 500), refetchOnWindowFocus: false, staleTime: 5000 },
  },
});

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="page">
          <div className="alert alert-error" role="alert">
            <div className="stack">
              <strong>Something went wrong on this screen.</strong>
              <span className="small">{String(this.state.error.message || this.state.error)}</span>
              <button className="btn btn-secondary btn-sm" onClick={() => window.location.reload()}>Reload</button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <App />
            <Toaster position="top-right" richColors closeButton />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
