import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { projectToScene } from "../../lib/geo";
import {
  checkBackendHealth,
  fetchMeshStatus,
  fetchMeshTopology,
  simulateMeshDelivery,
  simulateMeshOffline,
  simulateMeshOnline,
  fetchApiTriggers,
} from "../../lib/kinga-api";
import type { ApiTrigger } from "../../lib/kinga-types";
import type { MeshTopology, MeshNodeStatus } from "../../lib/kinga-api";

export const Route = createFileRoute("/_layout/mesh")({
  component: MeshPage,
});

interface SimulationResult {
  route: string[];
  hops: { from: string; to: string; latency_ms: number }[];
  total_latency: number;
  delivered: boolean;
}

function MeshPage() {
  const [topology, setTopology] = useState<MeshTopology | null>(null);
  const [status, setStatus] = useState<MeshNodeStatus[]>([]);
  const [live, setLive] = useState(false);
  const [triggers, setTriggers] = useState<ApiTrigger[]>([]);
  const [simResult, setSimResult] = useState<SimulationResult | null>(null);
  const [simRunning, setSimRunning] = useState(false);
  const [selectedOffline, setSelectedOffline] = useState<string[]>([]);

  useEffect(() => {
    const load = async () => {
      const ok = await checkBackendHealth();
      setLive(ok);
      if (!ok) return;
      const [topo, stat, trig] = await Promise.all([
        fetchMeshTopology(),
        fetchMeshStatus(),
        fetchApiTriggers(),
      ]);
      setTopology(topo);
      setStatus(stat);
      setTriggers(trig);
    };
    void load();
    const id = setInterval(() => void load(), 5000);
    return () => clearInterval(id);
  }, []);

  const statusMap = Object.fromEntries(status.map((s) => [s.id, s]));

  const runSimulation = async (dispatchId?: string) => {
    if (!live) return;
    setSimRunning(true);
    setSimResult(null);
    try {
      const result = (await simulateMeshDelivery(
        dispatchId,
        selectedOffline.length > 0 ? selectedOffline : undefined,
      )) as SimulationResult;
      setSimResult(result);
    } catch {
      setSimResult(null);
    } finally {
      setSimRunning(false);
    }
  };

  const toggleNodeOffline = async (nodeId: string) => {
    const next = selectedOffline.includes(nodeId)
      ? selectedOffline.filter((id) => id !== nodeId)
      : [...selectedOffline, nodeId];
    setSelectedOffline(next);
    if (live) {
      try {
        if (next.length > 0) {
          await simulateMeshOffline(next);
        }
      } catch {
        /* ignore */
      }
    }
  };

  const bringAllOnline = async () => {
    setSelectedOffline([]);
    if (live) {
      try {
        await simulateMeshOnline();
      } catch {
        /* ignore */
      }
    }
  };

  const criticalTriggers = triggers.filter(
    (t) => t.status === "triggered" || t.status === "activated",
  );

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-4">
      <header>
        <h1 className="text-lg font-bold tracking-widest text-sky-300">MESH RELAY NETWORK</h1>
        <p className="text-xs text-slate-500">
          Hop-to-hop delivery for degraded connectivity · {live ? "API live" : "offline"}
        </p>
      </header>

      <div className="grid flex-1 gap-4 lg:grid-cols-3">
        {/* Topology SVG */}
        <div className="relative col-span-2 min-h-[420px] overflow-hidden rounded-lg border border-slate-800 bg-slate-950/80">
          <svg viewBox="-7 -6 14 12" className="h-full w-full">
            <rect x="-7" y="-6" width="14" height="12" fill="#02060d" />
            {topology?.edges.map((e) => {
              const a = topology.nodes.find((n) => n.id === e.source);
              const b = topology.nodes.find((n) => n.id === e.target);
              if (!a || !b) return null;
              const p1 = projectToScene({ lat: a.lat, lon: a.lon });
              const p2 = projectToScene({ lat: b.lat, lon: b.lon });
              const aOffline = selectedOffline.includes(a.id) || statusMap[a.id]?.online === false;
              const bOffline = selectedOffline.includes(b.id) || statusMap[b.id]?.online === false;
              const edgeDown = aOffline || bOffline;
              return (
                <line
                  key={`${e.source}-${e.target}`}
                  x1={p1.x}
                  y1={p1.z}
                  x2={p2.x}
                  y2={p2.z}
                  stroke={edgeDown ? "#7f1d1d" : "#2478b8"}
                  strokeWidth="0.04"
                  opacity={edgeDown ? 0.3 : 0.5}
                  strokeDasharray={edgeDown ? "0.15 0.1" : undefined}
                />
              );
            })}
            {topology?.nodes.map((n) => {
              const { x, z } = projectToScene({ lat: n.lat, lon: n.lon });
              const isOffline = selectedOffline.includes(n.id) || statusMap[n.id]?.online === false;
              const isSimRoute = simResult?.route.includes(n.id);
              const color = isOffline
                ? "#64748b"
                : n.role === "gateway"
                  ? "#38bdf8"
                  : isSimRoute
                    ? "#22d3ee"
                    : "#22d3ee";
              return (
                <g key={n.id}>
                  <circle
                    cx={x}
                    cy={z}
                    r={n.role === "gateway" ? 0.28 : 0.18}
                    fill={color}
                    opacity={isOffline ? 0.4 : 0.9}
                  />
                  {isSimRoute && (
                    <circle
                      cx={x}
                      cy={z}
                      r={0.35}
                      fill="none"
                      stroke="#22d3ee"
                      strokeWidth="0.04"
                      opacity={0.6}
                    />
                  )}
                  <text
                    x={x}
                    y={z - 0.35}
                    textAnchor="middle"
                    fill={isOffline ? "#475569" : "#94a3b8"}
                    fontSize="0.22"
                  >
                    {n.label.split(" ")[0]}
                  </text>
                </g>
              );
            })}
            {simResult?.hops.map((hop, i) => {
              const fromNode = topology?.nodes.find((n) => n.id === hop.from);
              const toNode = topology?.nodes.find((n) => n.id === hop.to);
              if (!fromNode || !toNode) return null;
              const p1 = projectToScene({ lat: fromNode.lat, lon: fromNode.lon });
              const p2 = projectToScene({ lat: toNode.lat, lon: toNode.lon });
              return (
                <line
                  key={`sim-${i}`}
                  x1={p1.x}
                  y1={p1.z}
                  x2={p2.x}
                  y2={p2.z}
                  stroke="#22d3ee"
                  strokeWidth="0.08"
                  opacity={0.8}
                />
              );
            })}
          </svg>
        </div>

        {/* Right panel */}
        <div className="flex flex-col gap-3 overflow-auto">
          {/* Simulation controls */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
            <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500">
              Delivery Simulation
            </h2>
            <div className="space-y-2">
              <select
                className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200"
                defaultValue=""
                id="sim-dispatch"
              >
                <option value="" disabled>
                  Select trigger to simulate…
                </option>
                {criticalTriggers.map((t) => (
                  <option key={t.trigger_id} value={t.trigger_id}>
                    {t.trigger_id} · {t.admin_unit}
                  </option>
                ))}
              </select>
              <button
                onClick={() => {
                  const sel = document.getElementById("sim-dispatch") as HTMLSelectElement;
                  void runSimulation(sel?.value || undefined);
                }}
                disabled={simRunning || !live}
                className="w-full rounded border border-sky-500/50 bg-sky-500/10 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-sky-200 transition hover:bg-sky-500/20 disabled:opacity-40"
              >
                {simRunning ? "Simulating…" : "Run Simulation"}
              </button>
            </div>

            {simResult && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Delivered</span>
                  <span
                    className={`font-mono ${simResult.delivered ? "text-emerald-300" : "text-rose-300"}`}
                  >
                    {simResult.delivered ? "YES" : "NO"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Total latency</span>
                  <span className="font-mono text-slate-200">{simResult.total_latency}ms</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Hops</span>
                  <span className="font-mono text-slate-200">{simResult.hops?.length ?? 0}</span>
                </div>
                <div className="mt-2 space-y-1">
                  {simResult.hops?.map((hop, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 rounded border border-slate-800 bg-slate-900/40 px-2 py-1 text-[10px] font-mono"
                    >
                      <span className="text-slate-400">{hop.from}</span>
                      <span className="text-sky-400">→</span>
                      <span className="text-slate-400">{hop.to}</span>
                      <span className="ml-auto text-slate-500">{hop.latency_ms}ms</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Node management */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500">
                Node Management
              </h2>
              <button
                onClick={bringAllOnline}
                className="text-[10px] text-emerald-400 hover:text-emerald-300"
              >
                All online
              </button>
            </div>
            <div className="space-y-1.5">
              {(topology?.nodes ?? []).map((n) => {
                const isOffline =
                  selectedOffline.includes(n.id) || statusMap[n.id]?.online === false;
                return (
                  <button
                    key={n.id}
                    onClick={() => void toggleNodeOffline(n.id)}
                    className={`flex w-full items-center justify-between rounded border px-3 py-2 text-left text-xs transition ${
                      isOffline
                        ? "border-rose-500/30 bg-rose-500/5"
                        : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
                    }`}
                  >
                    <div>
                      <div className="font-mono text-slate-200">{n.id}</div>
                      <div className="text-[10px] text-slate-500">{n.label}</div>
                    </div>
                    <span
                      className={`rounded px-2 py-0.5 text-[9px] font-bold uppercase ${
                        isOffline
                          ? "bg-rose-500/15 text-rose-300"
                          : "bg-emerald-500/15 text-emerald-300"
                      }`}
                    >
                      {isOffline ? "offline" : "online"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Full topology list */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
            <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500">
              Topology
            </h2>
            <div className="space-y-1.5">
              {(topology?.nodes ?? []).map((n) => {
                const s = statusMap[n.id];
                return (
                  <div
                    key={n.id}
                    className="flex items-center justify-between rounded border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs"
                  >
                    <div>
                      <div className="font-mono text-slate-200">{n.id}</div>
                      <div className="text-[10px] text-slate-500">
                        {n.label} · {n.role}
                      </div>
                    </div>
                    <span
                      className={`rounded px-2 py-0.5 text-[9px] font-bold uppercase ${
                        s?.online
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-slate-700 text-slate-400"
                      }`}
                    >
                      {s?.online ? "online" : "offline"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
