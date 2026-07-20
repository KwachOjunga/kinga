import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { formatTimelineEat } from "../../lib/datetime";
import { checkBackendHealth, fetchTimeline } from "../../lib/kinga-api";
import type { TimelineEvent } from "../../lib/kinga-types";

export const Route = createFileRoute("/_layout/activations")({
  component: ActivationsPage,
});

const STAGE_STYLE: Record<TimelineEvent["stage"], string> = {
  ingest: "bg-slate-500/20 text-slate-300",
  armed: "bg-amber-400/20 text-amber-200",
  trigger: "bg-rose-500/25 text-rose-200",
  mesh: "bg-sky-400/20 text-sky-200",
  inst_ack: "bg-indigo-400/20 text-indigo-200",
  comm_ack: "bg-emerald-400/20 text-emerald-200",
};

function ActivationsPage() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const load = async () => {
      const ok = await checkBackendHealth();
      setLive(ok);
      if (!ok) return;
      setEvents(await fetchTimeline());
    };
    void load();
    const id = setInterval(() => void load(), 3000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-4">
      <header>
        <h1 className="text-lg font-bold tracking-widest text-sky-300">ACTIVATION TIMELINE</h1>
        <p className="text-xs text-slate-500">
          End-to-end event replay · ingest → armed → trigger → mesh → ack ·{" "}
          {live ? "API live" : "offline"}
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-slate-800 bg-slate-950/70 p-4">
        <div className="space-y-2 font-mono text-xs">
          {[...events].reverse().map((e, i) => (
            <div
              key={`${e.t}-${i}`}
              className="flex items-start gap-3 rounded border border-slate-900 bg-slate-950/60 px-3 py-2"
            >
              <span
                className={`shrink-0 rounded px-2 py-0.5 text-[9px] font-bold uppercase ${STAGE_STYLE[e.stage]}`}
              >
                {e.stage.replace("_", " ")}
              </span>
              <span className="shrink-0 text-slate-500">{formatTimelineEat(e.t)}</span>
              <span className="text-slate-300">{e.label}</span>
            </div>
          ))}
          {events.length === 0 && (
            <p className="text-slate-500">
              No activation events yet. Trigger a protocol from God&apos;s View.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
