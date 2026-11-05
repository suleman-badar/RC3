import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, errorMessage } from "./client";

const get = (url, params) => api.get(url, { params }).then((r) => r.data);

// ---------- queries ----------
export const useJobs = (status = "all") => useQuery({ queryKey: ["jobs", status], queryFn: () => get("/jobs", { status }) });
export const useJob = (id) => useQuery({ queryKey: ["job", id], queryFn: () => get(`/jobs/${id}`), enabled: !!id });
export const useApplicants = (jobId, filters) =>
  useQuery({
    queryKey: ["applicants", jobId, filters],
    queryFn: () => get(`/jobs/${jobId}/applications`, clean(filters)),
    enabled: !!jobId,
  });
export const useApplication = (id) =>
  useQuery({
    queryKey: ["application", id],
    queryFn: () => get(`/applications/${id}`),
    enabled: !!id,
    refetchInterval: (q) => (q.state.data?.assessment_status === "pending" ? 3000 : false),
  });
export const useMyApplications = () => useQuery({ queryKey: ["myApps"], queryFn: () => get("/applications/mine") });
export const useProfile = () => useQuery({ queryKey: ["profile"], queryFn: () => get("/profile/me") });
export const useAnalytics = (jobId) =>
  useQuery({ queryKey: ["analytics", jobId || "all"], queryFn: () => get("/analytics/summary", clean({ job_id: jobId })) });
export const useInterviews = () => useQuery({ queryKey: ["interviews"], queryFn: () => get("/interviews") });
export const useNotifications = () =>
  useQuery({ queryKey: ["notifications"], queryFn: () => get("/notifications"), refetchInterval: 15000 });

function clean(obj = {}) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== "" && v !== null && v !== undefined));
}

// ---------- mutations ----------
/**
 * Generic mutation: runs `fn`, invalidates the given query keys, shows toasts.
 * `success` may be a string or (data) => string. Pass `silentError` to handle errors yourself.
 */
export function useApiMutation(fn, { invalidate = [], success, silentError = false, onSuccess, onError } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data, vars) => {
      invalidate.forEach((key) => qc.invalidateQueries({ queryKey: key }));
      const msg = typeof success === "function" ? success(data, vars) : success;
      if (msg) toast.success(msg);
      onSuccess?.(data, vars);
    },
    onError: (err, vars) => {
      if (!silentError) toast.error(errorMessage(err));
      onError?.(err, vars);
    },
  });
}

/** Keys that change whenever an application changes. */
export const appKeys = (id) => [["application", id], ["applicants"], ["analytics"], ["interviews"], ["jobs"]];
