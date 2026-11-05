import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, TOKEN_KEY } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!localStorage.getItem(TOKEN_KEY));
  const qc = useQueryClient();

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    api
      .get("/auth/me")
      .then((r) => setUser(r.data))
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false));
  }, []);

  const signIn = useCallback(
    ({ token, user: u }) => {
      localStorage.setItem(TOKEN_KEY, token);
      qc.clear();
      setUser(u);
    },
    [qc]
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      /* token may already be invalid */
    }
    localStorage.removeItem(TOKEN_KEY);
    qc.clear();
    setUser(null);
  }, [qc]);

  const value = useMemo(() => ({ user, loading, signIn, logout }), [user, loading, signIn, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
export const homeFor = (user) => (user?.role === "recruiter" ? "/r" : "/c");
