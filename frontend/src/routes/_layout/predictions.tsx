import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart,
} from "recharts";

import { checkBackendHealth, fetchApiTriggers, fetchPredictions } from "../../lib/kinga-api";
import type { ApiTrigger } from "../../lib/kinga-types";

export const Route = createFileRoute("/_layout/predictions")({
  component: PredictionsPage,
});

interface ForecastPoint {
  day: number;
  indicator: string;
  predicted_value: number;
  confidence: number;
}

const INDICATOR_COLORS: Record<string, string> = {
  soil_moisture_pct: "#f5c518",
  seasonal_forecast_probability_below_normal: "#ff2f4a",
  rainfall_mm: "#38bdf8",
  ndvi: "#22d3ee",
  river_level_m: "#6366f1",
};

const INDICATOR_LABELS: Record<string, string> = {
  soil_moisture_pct: "Soil Moisture (%)",
  seasonal_forecast_probability_below_normal: "Below-Normal Prob.",
  rainfall_mm: "Rainfall (mm)",
  ndvi: "NDVI",
  river_level_m: "River Level (m)",
};

function PredictionsPage() {
  const [triggers, setTriggers] = useState<ApiTrigger[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<string>("");
  const [forecast, setForecast] = useState<ForecastPoint[]>([]);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const ok = await checkBackendHealth();
      setLive(ok);
      if (!ok) return;
      const rows = await fetchApiTriggers();
      setTriggers(rows);
      setSelectedUnit((prev) => prev || rows[0]?.admin_unit || "");
    };
    void load();
  }, []);

  useEffect(() => {
    if (!selectedUnit || !live) return;
    setLoading(true);
    const load = async () => {
      try {
        const data = await fetchPredictions(selectedUnit);
        setForecast(data.forecast ?? []);
      } catch {
        setForecast([]);
      } finally {
        setLoading(false);
      }
    };
    void load();
    const id = setInterval(() => void load(), 8000);
    return () => clearInterval(id);
  }, [selectedUnit, live]);

  const indicators = useMemo(() => {
    const set = new Set(forecast.map((f) => f.indicator));
    return Array.from(set);
  }, [forecast]);

  const triggerForUnit = triggers.find((t) => t.admin_unit === selectedUnit);

  const chartData = useMemo(() => {
    const byDay: Record<number, Record<string, unknown>> = {};
    for (const pt of forecast) {
      if (!byDay[pt.day]) byDay[pt.day] = { day: pt.day };
      byDay[pt.day][pt.indicator] = pt.predicted_value;
      byDay[pt.day][`${pt.indicator}_conf`] = pt.confidence;
    }
    return Object.values(byDay).sort((a, b) => (a.day as number) - (b.day as number));
  }, [forecast]);

  const uniqueAdminUnits = useMemo(() => {
    const set = new Set(triggers.map((t) => t.admin_unit));
    return Array.from(set);
  }, [triggers]);

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-4">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-widest text-sky-300">FORECAST VIEWER</h1>
          <p className="text-xs text-slate-500">
            14-day anticipation predictions per admin unit · {live ? "API live" : "offline"}
          </p>
        </div>
        <select
          value={selectedUnit}
          onChange={(e) => setSelectedUnit(e.target.value)}
          className="rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200"
        >
          {uniqueAdminUnits.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </header>

      {triggerForUnit && (
        <div className="flex gap-3">
          <div className="rounded border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs">
            <span className="text-slate-500">Hazard: </span>
            <span className="font-mono text-slate-200">{triggerForUnit.hazard}</span>
          </div>
          <div className="rounded border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs">
            <span className="text-slate-500">Status: </span>
            <span className="font-mono text-slate-200">{triggerForUnit.status}</span>
          </div>
          {triggerForUnit.arming_probability != null && (
            <div className="rounded border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs">
              <span className="text-slate-500">Arming P: </span>
              <span className="font-mono text-slate-200">
                {(triggerForUnit.arming_probability * 100).toFixed(0)}%
              </span>
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12 text-xs text-slate-500">
          Loading forecast data…
        </div>
      )}

      {!loading && forecast.length === 0 && (
        <div className="rounded border border-dashed border-slate-800 p-8 text-center text-xs text-slate-500">
          No forecast data available for this admin unit. Ensure the backend is running and the
          anticipation model is generating predictions.
        </div>
      )}

      {indicators.map((ind) => {
        const threshold = triggerForUnit?.conditions.find((c) => c.indicator === ind)?.threshold;
        const color = INDICATOR_COLORS[ind] ?? "#94a3b8";
        const label = INDICATOR_LABELS[ind] ?? ind;
        return (
          <div key={ind} className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500">
                {label}
              </h2>
              {threshold != null && (
                <span className="text-[10px] uppercase tracking-widest text-slate-600">
                  Threshold: {threshold}
                </span>
              )}
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id={`grad-${ind}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  tickFormatter={(d: number) => `D${d}`}
                />
                <YAxis tick={{ fontSize: 10, fill: "#64748b" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    border: "1px solid #1e293b",
                    borderRadius: 6,
                    fontSize: 11,
                  }}
                  labelFormatter={(d: number) => `Day ${d}`}
                />
                {threshold != null && (
                  <ReferenceLine
                    y={threshold}
                    stroke="#ff2f4a"
                    strokeDasharray="6 3"
                    label={{
                      value: "THRESHOLD",
                      position: "right",
                      fill: "#ff2f4a",
                      fontSize: 9,
                    }}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey={ind}
                  stroke={color}
                  fill={`url(#grad-${ind})`}
                  strokeWidth={2}
                  dot={{ r: 3, fill: color }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        );
      })}

      {forecast.length > 0 && (
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500">
            Confidence Scores
          </h2>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {forecast
              .filter((f) => f.day <= 7)
              .map((f, i) => (
                <div
                  key={`${f.indicator}-${f.day}-${i}`}
                  className="flex items-center justify-between rounded border border-slate-800 bg-slate-900/40 px-3 py-1.5 text-xs"
                >
                  <span className="text-slate-400">
                    {INDICATOR_LABELS[f.indicator] ?? f.indicator} · D{f.day}
                  </span>
                  <span
                    className={`font-mono ${f.confidence > 0.7 ? "text-emerald-300" : f.confidence > 0.4 ? "text-amber-300" : "text-rose-300"}`}
                  >
                    {(f.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
