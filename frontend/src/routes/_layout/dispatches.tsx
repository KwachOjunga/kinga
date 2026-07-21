import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { checkBackendHealth, fetchApiTriggers, fetchFullDispatch } from "../../lib/kinga-api";
import { formatTimelineEat } from "../../lib/datetime";
import type { ApiTrigger, ApiDispatch } from "../../lib/kinga-types";

export const Route = createFileRoute("/_layout/dispatches")({
  component: DispatchesPage,
});

interface FullDispatch extends ApiDispatch {
  hops?: { from_node: string; to_node: string; arrived_at: string; latency_ms: number }[];
  delivered?: boolean;
}

function DispatchesPage() {
  const [triggers, setTriggers] = useState<ApiTrigger[]>([]);
  const [dispatches, setDispatches] = useState<Record<string, FullDispatch>>({});
  const [selectedId, setSelectedId] = useState<string>("");
  const [live, setLive] = useState(false);

  useEffect(() => {
    const load = async () => {
      const ok = await checkBackendHealth();
      setLive(ok);
      if (!ok) return;
      const rows = await fetchApiTriggers();
      setTriggers(rows);
      for (const t of rows) {
        if (t.status === "triggered" || t.status === "activated" || t.status === "confirmed") {
          try {
            const data = await fetchFullDispatch(t.trigger_id);
            if (data) {
              setDispatches((prev) => ({ ...prev, [t.trigger_id]: data }));
            }
          } catch {
            /* skip */
          }
        }
      }
    };
    void load();
    const id = setInterval(() => void load(), 5000);
    return () => clearInterval(id);
  }, []);

  const dispatchList = Object.entries(dispatches);
  const selected = selectedId ? dispatches[selectedId] : null;
  const selectedTrigger = selectedId ? triggers.find((t) => t.trigger_id === selectedId) : null;

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-4">
      <header>
        <h1 className="text-lg font-bold tracking-widest text-sky-300">DISPATCH LOG</h1>
        <p className="text-xs text-slate-500">
          Hop-by-hop delivery records · {live ? "API live" : "offline"}
        </p>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-3">
        {/* Trigger list */}
        <div className="space-y-2 overflow-auto rounded-lg border border-slate-800 bg-slate-950/70 p-3">
          <h2 className="mb-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500">
            Active Triggers
          </h2>
          {triggers
            .filter(
              (t) =>
                t.status === "triggered" || t.status === "activated" || t.status === "confirmed",
            )
            .map((t) => (
              <button
                key={t.trigger_id}
                onClick={() => setSelectedId(t.trigger_id)}
                className={`w-full rounded border px-3 py-2 text-left text-xs transition ${
                  selectedId === t.trigger_id
                    ? "border-sky-500/50 bg-sky-500/10"
                    : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-slate-200">{t.trigger_id}</span>
                  <span
                    className={`rounded border px-2 py-0.5 text-[9px] font-bold uppercase ${
                      t.status === "triggered"
                        ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                        : t.status === "activated"
                          ? "border-sky-500/30 bg-sky-500/10 text-sky-300"
                          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                    }`}
                  >
                    {t.status}
                  </span>
                </div>
                <div className="mt-1 text-[10px] text-slate-500">
                  {t.country} · {t.admin_unit}
                </div>
              </button>
            ))}
          {triggers.filter(
            (t) => t.status === "triggered" || t.status === "activated" || t.status === "confirmed",
          ).length === 0 && (
            <div className="rounded border border-dashed border-slate-800 p-3 text-xs text-slate-500">
              No active dispatches. Force a trigger from God&apos;s View.
            </div>
          )}
        </div>

        {/* Dispatch detail */}
        <div className="col-span-2 overflow-auto rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          {!selected && (
            <div className="flex h-full items-center justify-center text-xs text-slate-500">
              Select a trigger to view its dispatch record.
            </div>
          )}

          {selected && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-mono text-sm text-sky-200">{selected.trigger_id}</h2>
                  <p className="text-[10px] text-slate-500">
                    {selectedTrigger?.admin_unit}, {selectedTrigger?.country}
                  </p>
                </div>
                <span
                  className={`rounded px-2 py-0.5 text-[9px] font-bold uppercase ${
                    selected.delivered
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-rose-500/15 text-rose-300"
                  }`}
                >
                  {selected.delivered ? "delivered" : "pending"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded border border-slate-800 bg-slate-900/40 px-3 py-2">
                  <div className="text-[9px] uppercase tracking-widest text-slate-500">
                    Dispatch ID
                  </div>
                  <div className="font-mono text-xs text-slate-200">{selected.dispatch_id}</div>
                </div>
                <div className="rounded border border-slate-800 bg-slate-900/40 px-3 py-2">
                  <div className="text-[9px] uppercase tracking-widest text-slate-500">
                    Dispatched At
                  </div>
                  <div className="font-mono text-xs text-slate-200">
                    {formatTimelineEat(new Date(selected.dispatched_at).getTime())} EAT
                  </div>
                </div>
              </div>

              {/* Delivery route */}
              <div>
                <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500">
                  Delivery Route
                </h3>
                <div className="flex items-center gap-1 flex-wrap">
                  {selected.delivery_route.map((node, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <div className="rounded border border-slate-800 bg-slate-900/60 px-2 py-1 font-mono text-[10px] text-slate-300">
                        {node}
                      </div>
                      {i < selected.delivery_route.length - 1 && (
                        <span className="text-sky-400">→</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Hop-by-hop timeline */}
              {selected.hops && selected.hops.length > 0 && (
                <div>
                  <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500">
                    Hop-by-Hop Timeline
                  </h3>
                  <div className="space-y-0">
                    {selected.hops.map((hop, i) => (
                      <div key={i} className="relative flex items-start gap-3 pl-4">
                        <div className="absolute left-0 top-0 h-full w-px bg-slate-800" />
                        <div className="absolute left-[-3px] top-1.5 h-[7px] w-[7px] rounded-full bg-sky-400" />
                        <div className="flex-1 rounded border border-slate-800 bg-slate-900/40 px-3 py-2">
                          <div className="flex items-center justify-between">
                            <div className="font-mono text-[10px] text-slate-300">
                              {hop.from_node} → {hop.to_node}
                            </div>
                            <div className="font-mono text-[10px] text-slate-500">
                              {hop.latency_ms}ms
                            </div>
                          </div>
                          <div className="mt-0.5 text-[9px] text-slate-600">
                            {formatTimelineEat(new Date(hop.arrived_at).getTime())} EAT
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(!selected.hops || selected.hops.length === 0) && (
                <div className="rounded border border-dashed border-slate-800 p-4 text-center text-xs text-slate-500">
                  No hop-by-hop data available. Run a mesh simulation to generate delivery records.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
