import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { checkBackendHealth, fetchScorecard } from "../../lib/kinga-api";
import type { ApiScorecardEntry } from "../../lib/kinga-types";

export const Route = createFileRoute("/_layout/scorecard")({
  component: ScorecardPage,
});

const STATUS_LABEL: Record<ApiScorecardEntry["status"], { label: string; className: string }> = {
  on_track: { label: "On track", className: "bg-emerald-500/15 text-emerald-300" },
  slow: { label: "Slow", className: "bg-amber-500/15 text-amber-300" },
  overdue: { label: "Overdue", className: "bg-rose-500/15 text-rose-300" },
};

function ScorecardPage() {
  const [rows, setRows] = useState<ApiScorecardEntry[]>([]);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const load = async () => {
      const ok = await checkBackendHealth();
      setLive(ok);
      if (!ok) return;
      setRows(await fetchScorecard());
    };
    void load();
    const id = setInterval(() => void load(), 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-4">
      <header>
        <h1 className="text-lg font-bold tracking-widest text-sky-300">
          INSTITUTIONAL RESPONSIVENESS
        </h1>
        <p className="text-xs text-slate-500">
          Average time-to-acknowledge per institution · {live ? "API live" : "offline"}
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => {
          const meta = STATUS_LABEL[row.status];
          return (
            <div
              key={row.institution}
              className="rounded-lg border border-slate-800 bg-slate-950/70 p-4"
            >
              <div className="text-sm text-slate-200">{row.institution}</div>
              <div className="mt-3 flex items-end justify-between">
                <div>
                  <div className="text-2xl font-bold font-mono text-sky-300">
                    {row.avg_ack_hours}h
                  </div>
                  <div className="text-[10px] uppercase tracking-widest text-slate-500">
                    avg ack time
                  </div>
                </div>
                <span
                  className={`rounded px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${meta.className}`}
                >
                  {meta.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
