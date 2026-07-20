import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import {
  checkBackendHealth,
  fetchApiTriggers,
  fetchScorecard,
  fetchTimelineAll,
} from "../../lib/kinga-api";
import { formatTimelineEat } from "../../lib/datetime";
import type { ApiTrigger, ApiScorecardEntry, ApiTimelineEvent } from "../../lib/kinga-types";

export const Route = createFileRoute("/_layout/institutions")({
  component: InstitutionsPage,
});

function InstitutionsPage() {
  const [triggers, setTriggers] = useState<ApiTrigger[]>([]);
  const [scorecard, setScorecard] = useState<ApiScorecardEntry[]>([]);
  const [timeline, setTimeline] = useState<ApiTimelineEvent[]>([]);
  const [live, setLive] = useState(false);
  const [selectedInst, setSelectedInst] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const ok = await checkBackendHealth();
      setLive(ok);
      if (!ok) return;
      const [trig, score, tlData] = await Promise.all([
        fetchApiTriggers(),
        fetchScorecard(),
        fetchTimelineAll(100),
      ]);
      setTriggers(trig);
      setScorecard(score);
      if (tlData.length > 0) {
        setTimeline(tlData);
      }
    };
    void load();
    const id = setInterval(() => void load(), 5000);
    return () => clearInterval(id);
  }, []);

  const triggersByInst = useMemo(() => {
    const map: Record<string, ApiTrigger[]> = {};
    for (const t of triggers) {
      const name = t.responsible_institution?.name;
      if (!name) continue;
      const key = name.split(",")[0].trim();
      if (!map[key]) map[key] = [];
      map[key].push(t);
    }
    return map;
  }, [triggers]);

  const selectedData = selectedInst ? scorecard.find((s) => s.institution === selectedInst) : null;
  const selectedTriggers = selectedInst ? (triggersByInst[selectedInst] ?? []) : [];
  const selectedTriggerIds = new Set(selectedTriggers.map((t) => t.trigger_id));
  const selectedTimeline = timeline.filter(
    (e) => e.trigger_id && selectedTriggerIds.has(e.trigger_id),
  );

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-4">
      <header>
        <h1 className="text-lg font-bold tracking-widest text-sky-300">INSTITUTION DEEP DIVE</h1>
        <p className="text-xs text-slate-500">
          Per-institution accountability &amp; response tracking · {live ? "API live" : "offline"}
        </p>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-3">
        {/* Institution list */}
        <div className="space-y-2 overflow-auto rounded-lg border border-slate-800 bg-slate-950/70 p-3">
          {scorecard.map((s) => {
            const triggers = triggersByInst[s.institution] ?? [];
            const isSelected = selectedInst === s.institution;
            return (
              <button
                key={s.institution}
                onClick={() => setSelectedInst(isSelected ? null : s.institution)}
                className={`w-full rounded border px-3 py-2 text-left text-xs transition ${
                  isSelected
                    ? "border-sky-500/50 bg-sky-500/10"
                    : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
                }`}
              >
                <div className="font-mono text-slate-200">{s.institution}</div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500">
                    {triggers.length} trigger{triggers.length !== 1 ? "s" : ""}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-400">{s.avg_ack_hours}h</span>
                    <StatusBadge status={s.status} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Detail */}
        <div className="col-span-2 overflow-auto rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          {!selectedInst && (
            <div className="flex h-full items-center justify-center text-xs text-slate-500">
              Select an institution to view its response profile.
            </div>
          )}

          {selectedInst && selectedData && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-sky-200">{selectedInst}</h2>
                  <p className="text-[10px] text-slate-500">
                    {selectedTriggers.length} assigned trigger
                    {selectedTriggers.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <StatusBadge status={selectedData.status} />
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded border border-slate-800 bg-slate-900/40 px-3 py-2">
                  <div className="text-[9px] uppercase tracking-widest text-slate-500">
                    Avg Ack Time
                  </div>
                  <div className="font-mono text-lg text-slate-200">
                    {selectedData.avg_ack_hours}h
                  </div>
                </div>
                <div className="rounded border border-slate-800 bg-slate-900/40 px-3 py-2">
                  <div className="text-[9px] uppercase tracking-widest text-slate-500">
                    Total Budget
                  </div>
                  <div className="font-mono text-lg text-slate-200">
                    $
                    {selectedTriggers
                      .reduce((s, t) => s + (t.action?.budget_envelope_usd ?? 0), 0)
                      .toLocaleString()}
                  </div>
                </div>
                <div className="rounded border border-slate-800 bg-slate-900/40 px-3 py-2">
                  <div className="text-[9px] uppercase tracking-widest text-slate-500">
                    Escalation Contact
                  </div>
                  <div className="text-xs text-slate-300">
                    {selectedTriggers[0]?.responsible_institution?.escalation_contact ?? "—"}
                  </div>
                </div>
              </div>

              {/* Assigned triggers */}
              <div>
                <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500">
                  Assigned Triggers
                </h3>
                <div className="space-y-2">
                  {selectedTriggers.map((t) => (
                    <div
                      key={t.trigger_id}
                      className="rounded border border-slate-800 bg-slate-900/40 px-3 py-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs text-slate-200">{t.trigger_id}</span>
                        <StatusBadge status={t.status} />
                      </div>
                      <div className="mt-1 text-[10px] text-slate-500">
                        {t.country} · {t.admin_unit} · {t.hazard}
                      </div>
                      {t.action && (
                        <div className="mt-1 text-[10px] text-slate-400">
                          Action: {t.action.description}
                        </div>
                      )}
                      {t.community_broadcast?.enabled && (
                        <div className="mt-1 text-[10px] text-sky-400">
                          Community broadcast: {t.community_broadcast.language.join(", ")}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Timeline for this institution */}
              <div>
                <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500">
                  Recent Activity
                </h3>
                {selectedTimeline.length > 0 ? (
                  <div className="space-y-1 font-mono text-[11px]">
                    {[...selectedTimeline]
                      .reverse()
                      .slice(0, 10)
                      .map((e, i) => (
                        <div
                          key={`${e.t}-${i}`}
                          className="flex items-center gap-2 rounded border border-slate-900 bg-slate-950/50 px-2 py-1"
                        >
                          <span className="shrink-0 text-slate-500">
                            {formatTimelineEat(new Date(e.t).getTime())}
                          </span>
                          <span className="text-slate-300">{e.label}</span>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">No recent activity.</p>
                )}
              </div>
            </div>
          )}
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
