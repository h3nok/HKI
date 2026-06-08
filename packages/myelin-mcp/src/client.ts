import type { AgentRun, RunSummary } from "@myelin/core";

const API_URL = process.env.AGENTGRAPH_API_URL ?? "http://localhost:8090";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Myelin API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export interface RunListItem {
  id: string;
  query: string;
  status: string;
  hki_domain: string | null;
  model: string | null;
  confidence: number | null;
  started_at: string;
  ended_at: string | null;
  node_count: number;
}

export const apiClient = {
  listRuns: (params?: { limit?: number; domain?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.domain) qs.set("domain", params.domain);
    if (params?.status) qs.set("status", params.status);
    const q = qs.toString();
    return apiFetch<{ runs: RunListItem[] }>(`/runs${q ? `?${q}` : ""}`);
  },

  getRun: (runId: string) => apiFetch<AgentRun>(`/runs/${runId}`),

  getRunSummary: (runId: string) =>
    apiFetch<RunSummary>(`/runs/${runId}/summary`),

  diffRuns: (runIdA: string, runIdB: string) =>
    apiFetch<{ diff: unknown }>(`/runs/${runIdA}/diff/${runIdB}`, {
      method: "POST",
    }),
};
