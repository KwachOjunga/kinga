import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { checkBackendHealth, fetchApiTriggers, fetchScorecard } from "../../lib/kinga-api";
import type { ApiTrigger, ApiScorecardEntry } from "../../lib/kinga-types";

export const Route = createFileRoute("/_layout/regions")({
  component: RegionsPage,
});

const IGAD_STATES = [
  "Djibouti",
  "Eritrea",
  "Ethiopia",
  "Kenya",
  "Somalia",
  "South Sudan",
  "Sudan",
  "Uganda",
];

const COUNTRY_FLAGS: Record<string, string> = {
  Djibouti: "DJ",
  Eritrea: "ER",
  Ethiopia: "ET",
  Kenya: "KE",
  Somalia: "SO",
  "South Sudan": "SS",
  Sudan: "SD",
  Uganda: "UG",
};

function RegionsPage() {
  const [triggers, setTriggers] = useState<ApiTrigger[]>([]);
  const [scorecard, setScorecard] = useState<ApiScorecardEntry[]>([]);
  const [live, setLive] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const ok = await checkBackendHealth();
      setLive(ok);
      if (!ok) return;
      const [trig, score] = await Promise.all([fetchApiTriggers(), fetchScorecard()]);
      setTriggers(trig);
      setScorecard(score);
    };
    void load();
    const id = setInterval(() => void load(), 5000);
    return () => clearInterval(id);
  }, []);

  const byCountry = useMemo(() => {
    const map: Record<string, ApiTrigger[]> = {};
    for (const t of triggers) {
      if (!map[t.country]) map[t.country] = [];
      map[t.country].push(t);
    }
    return map;
  }, [triggers]);

  const selectedTriggers = selectedCountry ? (byCountry[selectedCountry] ?? []) : [];
  const totalBudget = selectedTriggers.reduce(
    (sum, t) => sum + (t.action?.budget_envelope_usd ?? 0),
    0,
  );
  const armedCount = selectedTriggers.filter(
    (t) => t.status === "arming" || t.status === "triggered" || t.status === "activated",
  ).length;

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-4">
      <header>
        <h1 className="text-lg font-bold tracking-widest text-sky-300">REGIONAL OVERVIEW</h1>
        <p className="text-xs text-slate-500">
          IGAD member states · anticipatory action coverage · {live ? "API live" : "offline"}
        </p>
      </header>

      {/* Country grid */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {IGAD_STATES.map((country) => {
          const countryTriggers = byCountry[country] ?? [];
          const activeCount = countryTriggers.filter(
            (t) => t.status === "arming" || t.status === "triggered" || t.status === "activated",
          ).length;
          const budget = countryTriggers.reduce(
            (sum, t) => sum + (t.action?.budget_envelope_usd ?? 0),
            0,
          );
          const isSelected = selectedCountry === country;
          return (
            <button
              key={country}
              onClick={() => setSelectedCountry(isSelected ? null : country)}
              className={`rounded-lg border p-4 text-left transition ${
                isSelected
                  ? "border-sky-500/50 bg-sky-500/10"
                  : "border-slate-800 bg-slate-950/70 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded border border-slate-700 bg-slate-900 text-[10px] font-bold text-slate-300">
                  {COUNTRY_FLAGS[country] ?? "??"}
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-200">{country}</div>
                  <div className="text-[10px] text-slate-500">
                    {countryTriggers.length} trigger{countryTriggers.length !== 1 ? "s" : ""}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {activeCount > 0 && (
                    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
                      {activeCount} active
                    </span>
                  )}
                </div>
                {budget > 0 && (
                  <span className="text-[10px] font-mono text-slate-400">
                    ${budget.toLocaleString()}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Detail panel */}
      {selectedCountry && (
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-sky-300">{selectedCountry}</h2>
            <div className="flex gap-3 text-xs">
              <span className="text-slate-500">
                {selectedTriggers.length} trigger{selectedTriggers.length !== 1 ? "s" : ""}
              </span>
              <span className="text-slate-500">{armedCount} armed/triggered</span>
              <span className="font-mono text-slate-400">
                ${totalBudget.toLocaleString()} at risk
              </span>
            </div>
          </div>

          {selectedTriggers.length === 0 && (
            <p className="text-xs text-slate-500">No triggers defined for {selectedCountry} yet.</p>
          )}

          <div className="space-y-2">
            {selectedTriggers.map((t) => (
              <div
                key={t.trigger_id}
                className="flex items-center justify-between rounded border border-slate-800 bg-slate-900/40 px-3 py-2"
              >
                <div>
                  <div className="font-mono text-xs text-slate-200">{t.trigger_id}</div>
                  <div className="text-[10px] text-slate-500">
                    {t.admin_unit} · {t.hazard}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {t.action && (
                    <span className="text-[10px] font-mono text-slate-400">
                      ${t.action.budget_envelope_usd.toLocaleString()}
                    </span>
                  )}
                  <StatusBadge status={t.status} />
                </div>
              </div>
            ))}
          </div>

          {/* Institutions for this country */}
          {scorecard.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500">
                Responsible Institutions
              </h3>
              <div className="space-y-1.5">
                {scorecard
                  .filter((s) =>
                    selectedTriggers.some((t) =>
                      t.responsible_institution?.name
                        ?.toLowerCase()
                        .includes(s.institution.toLowerCase().split(",")[0]),
                    ),
                  )
                  .map((s) => (
                    <div
                      key={s.institution}
                      className="flex items-center justify-between rounded border border-slate-800 bg-slate-900/40 px-3 py-1.5 text-xs"
                    >
                      <span className="text-slate-300">{s.institution}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-slate-400">{s.avg_ack_hours}h</span>
                        <StatusBadge status={s.status} />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Summary stats */}
      <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
        <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500">
          Region-Wide Summary
        </h2>
        <div className="grid gap-2 md:grid-cols-4">
          <Stat label="Total Triggers" value={triggers.length} />
          <Stat
            label="Armed / Triggered"
            value={
              triggers.filter(
                (t) =>
                  t.status === "arming" || t.status === "triggered" || t.status === "activated",
              ).length
            }
          />
          <Stat
            label="Total Budget at Risk"
            value={`$${triggers
              .reduce((s, t) => s + (t.action?.budget_envelope_usd ?? 0), 0)
              .toLocaleString()}`}
          />
          <Stat label="Countries Covered" value={Object.keys(byCountry).length} />
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    dormant: "bg-emerald-500/10 text-emerald-300",
    arming: "bg-amber-500/10 text-amber-300",
    triggered: "bg-rose-500/10 text-rose-300",
    activated: "bg-sky-500/10 text-sky-300",
    confirmed: "bg-emerald-400/10 text-emerald-200",
    on_track: "bg-emerald-500/10 text-emerald-300",
    slow: "bg-amber-500/10 text-amber-300",
    overdue: "bg-rose-500/10 text-rose-300",
  };
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${map[status] ?? "bg-slate-700 text-slate-400"}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded border border-slate-800 bg-slate-900/40 px-3 py-2">
      <div className="text-[9px] uppercase tracking-widest text-slate-500">{label}</div>
      <div className="font-mono text-lg text-slate-200">{value}</div>
    </div>
  );
}
