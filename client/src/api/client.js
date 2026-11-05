import axios from "axios";

export const TOKEN_KEY = "evident_token";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000/api",
  timeout: 90000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || "";
    if (status === 401 && !url.includes("/auth/login") && !url.includes("/auth/register")) {
      localStorage.removeItem(TOKEN_KEY);
      if (!window.location.pathname.startsWith("/login")) window.location.assign("/login");
    }
    return Promise.reject(error);
  }
);

/** Human-readable message from any API error. */
export function errorMessage(error, fallback = "Something went wrong") {
  if (!error) return fallback;
  if (!error.response) return "Cannot reach the server. Is the API running?";
  const detail = error.response.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) => `${(d.loc || []).filter((x) => x !== "body").join(".")}: ${d.msg}`.replace(/^: /, ""))
      .join("; ");
  }
  if (detail?.message) return detail.message;
  return fallback;
}
