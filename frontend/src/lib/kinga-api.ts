import type {
  ApiDispatch,
  ApiScorecardEntry,
  ApiTimelineEvent,
  ApiTrigger,
  RegionNode,
  TimelineEvent,
} from "./kinga-types";
import { triggerToRegionNode } from "./kinga-types";

const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) || "http://localhost:8000";

export class KingaApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "KingaApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new KingaApiError(detail || res.statusText, res.status);
  }
  return res.json() as Promise<T>;
}

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchApiTriggers(): Promise<ApiTrigger[]> {
  return request<ApiTrigger[]>("/triggers");
}

export interface MeshTopology {
  nodes: { id: string; label: string; lat: number; lon: number; role: string }[];
  edges: { source: string; target: string; latency_ms: number }[];
}

export interface MeshNodeStatus {
  id: string;
  online: boolean;
  last_seen: string;
}

export async function fetchMeshTopology(): Promise<MeshTopology> {
  return request<MeshTopology>("/mesh/topology");
}

export async function fetchMeshStatus(): Promise<MeshNodeStatus[]> {
  return request<MeshNodeStatus[]>("/mesh/status");
}

export async function fetchPredictions(adminUnit: string): Promise<{
  admin_unit: string;
  forecast: { day: number; indicator: string; predicted_value: number; confidence: number }[];
}> {
  return request(`/predict/${encodeURIComponent(adminUnit)}`);
}

export async function fetchTriggers(): Promise<RegionNode[]> {
  const triggers = await request<ApiTrigger[]>("/triggers");
  return triggers.map(triggerToRegionNode);
}

export async function fetchTrigger(triggerId: string): Promise<ApiTrigger> {
  return request<ApiTrigger>(`/triggers/${encodeURIComponent(triggerId)}`);
}

export async function activateTrigger(triggerId: string): Promise<ApiDispatch> {
  return request<ApiDispatch>(`/activate/${encodeURIComponent(triggerId)}`, {
    method: "POST",
  });
}

export async function acknowledgeDispatch(
  dispatchId: string,
  acknowledgedBy: string,
  notes?: string,
): Promise<unknown> {
  return request(`/acknowledge/${encodeURIComponent(dispatchId)}`, {
    method: "POST",
    body: JSON.stringify({
      acknowledged_by: acknowledgedBy,
      action_taken: true,
      notes,
    }),
  });
}

export async function acknowledgeCommunity(
  dispatchId: string,
  acknowledgedBy: string,
): Promise<unknown> {
  return request(`/acknowledge-community/${encodeURIComponent(dispatchId)}`, {
    method: "POST",
    body: JSON.stringify({
      acknowledged_by: acknowledgedBy,
      received: true,
      action_taken: true,
    }),
  });
}

export async function fetchScorecard(): Promise<ApiScorecardEntry[]> {
  return request<ApiScorecardEntry[]>("/institutions/scorecard");
}

export async function fetchTimeline(): Promise<TimelineEvent[]> {
  const events = await request<ApiTimelineEvent[]>(`/timeline?limit=20`);
  return events.map((e) => ({
    t: new Date(e.t).getTime(),
    label: e.label,
    stage: e.stage,
  }));
}

export async function simulateMeshOffline(nodeIds: string[]): Promise<void> {
  await request("/mesh/offline", {
    method: "POST",
    body: JSON.stringify({ node_ids: nodeIds }),
  });
}

export async function simulateMeshDelivery(
  dispatchId?: string,
  forceOffline?: string[],
): Promise<unknown> {
  return request("/mesh/simulate", {
    method: "POST",
    body: JSON.stringify({
      dispatch_id: dispatchId,
      force_offline: forceOffline ?? [],
    }),
  });
}

export async function refreshTriggers(): Promise<void> {
  await request("/triggers/refresh", { method: "POST" });
}

export async function fetchLatestDispatch(triggerId: string): Promise<string | null> {
  try {
    const data = await request<{ dispatch_id: string }>(
      `/triggers/${encodeURIComponent(triggerId)}/dispatch`,
    );
    return data.dispatch_id;
  } catch {
    return null;
  }
}

export async function fetchFullDispatch(triggerId: string): Promise<{
  dispatch_id: string;
  trigger_id: string;
  dispatched_at: string;
  delivery_route: string[];
  hops: { from_node: string; to_node: string; arrived_at: string; latency_ms: number }[];
  delivered: boolean;
} | null> {
  try {
    return await request(`/triggers/${encodeURIComponent(triggerId)}/dispatch`);
  } catch {
    return null;
  }
}

export async function createTrigger(payload: Record<string, unknown>): Promise<unknown> {
  return request("/triggers", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function simulateMeshOnline(): Promise<void> {
  await request("/mesh/online", { method: "POST" });
}

export async function fetchTimelineAll(limit = 100): Promise<ApiTimelineEvent[]> {
  return request<ApiTimelineEvent[]>(`/timeline?limit=${limit}`);
}

export { API_BASE };
