import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { checkBackendHealth, fetchApiTriggers } from "../../lib/kinga-api";
import type { ApiTrigger } from "../../lib/kinga-types";

export const Route = createFileRoute("/_layout/triggers")({
  component: TriggersPage,
});

const STATUS_STYLE: Record<string, string> = {
  dormant: "text-emerald-300 bg-emerald-500/10 border-emerald-600/30",
  arming: "text-amber-300 bg-amber-500/10 border-amber-500/30",
  triggered: "text-rose-300 bg-rose-500/10 border-rose-500/30",
  activated: "text-sky-300 bg-sky-500/10 border-sky-500/30",
  confirmed: "text-emerald-200 bg-emerald-400/10 border-emerald-400/30",
};

function TriggersPage() {
  const [triggers, setTriggers] = useState<ApiTrigger[]>([]);
  const [selected, setSelected] = useState<ApiTrigger | null>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const load = async () => {
      const ok = await checkBackendHealth();
      setLive(ok);
      if (!ok) return;
      const rows = await fetchApiTriggers();
      setTriggers(rows);
      setSelected((prev) => prev ?? rows[0] ?? null);
    };
    void load();
    const id = setInterval(() => void load(), 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-4">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-widest text-sky-300">TRIGGER REGISTRY</h1>
          <p className="text-xs text-slate-500">
            Anticipatory Action protocols · {live ? "API live" : "offline"}
          </p>
        </div>
        <Link
          to="/trigger-builder"
          className="rounded border border-sky-500/50 bg-sky-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-sky-200 transition hover:bg-sky-500/20"
        >
          + New Trigger
        </Link>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
        <div className="space-y-2 overflow-auto rounded-lg border border-slate-800 bg-slate-950/70 p-3">
          {triggers.map((t) => (
            <button
              key={t.trigger_id}
              onClick={() => setSelected(t)}
              className={`w-full rounded border px-3 py-2 text-left text-xs transition ${
                selected?.trigger_id === t.trigger_id
                  ? "border-sky-500/50 bg-sky-500/10"
                  : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-slate-200">{t.trigger_id}</span>
                <span
                  className={`rounded border px-2 py-0.5 text-[9px] font-bold uppercase ${STATUS_STYLE[t.status] ?? ""}`}
                >
                  {t.status}
                </span>
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-widest text-slate-500">
                {t.country} · {t.admin_unit} · {t.hazard}
              </div>
            </button>
          ))}
        </div>

        {selected && (
          <div className="overflow-auto rounded-lg border border-slate-800 bg-slate-950/70 p-4 text-sm">
            <h2 className="font-mono text-sky-200">{selected.trigger_id}</h2>
            <p className="mt-1 text-xs text-slate-500">
              {selected.admin_unit}, {selected.country}
            </p>

            <h3 className="mt-4 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Conditions
            </h3>
            <div className="mt-2 space-y-2">
              {selected.conditions.map((c) => (
                <div
                  key={c.indicator}
                  className="rounded border border-slate-800 bg-slate-900/40 p-3 text-xs"
                >
                  <div className="font-mono text-slate-300">{c.indicator}</div>
                  <div className="mt-1 text-slate-400">
                    {c.operator} {c.threshold} {c.unit}
                    {c.current_value != null && (
                      <span className="ml-2 text-amber-300">now: {c.current_value}</span>
                    )}
                  </div>
                  {c.rationale && (
                    <p className="mt-1 text-slate-500 leading-relaxed">{c.rationale}</p>
                  )}
                </div>
              ))}
            </div>

            {selected.action && (
              <>
                <h3 className="mt-4 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  Pre-agreed action
                </h3>
                <p className="mt-2 text-xs text-slate-300">{selected.action.description}</p>
                <p className="mt-1 font-mono text-xs text-slate-500">
                  ${selected.action.budget_envelope_usd.toLocaleString()} USD
                </p>
              </>
            )}

            {selected.responsible_institution && (
              <>
                <h3 className="mt-4 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  Responsible institution
                </h3>
                <p className="mt-2 text-xs text-slate-300">
                  {selected.responsible_institution.name}
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
