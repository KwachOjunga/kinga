import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_layout/about")({
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="flex h-full flex-col gap-6 overflow-auto p-6">
      <header>
        <h1 className="text-lg font-bold tracking-widest text-sky-300">ABOUT KINGA</h1>
        <p className="text-xs text-slate-500">
          An anticipatory action trigger &amp; activation engine for the IGAD region
        </p>
      </header>

      {/* Problem */}
      <section className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500">
          The Problem
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">
          ICPAC's own technical reporting on regional flood impact states plainly:
        </p>
        <blockquote className="mt-3 border-l-2 border-sky-500/50 pl-4 text-sm italic text-slate-200">
          "The extent of the impacts of these floods shows the gaps in preparedness and early action
          despite early warning information being availed on time."
        </blockquote>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">
          Prediction is not the bottleneck. Wiring warnings to action is. As of mid-2025, IGAD is
          actively commissioning a consultant to manually reconstruct anticipatory-action trigger
          and activation data across 8 member states for 2020–2025. There is no digital system doing
          this tracking. Kinga is that system.
        </p>
      </section>

      {/* What Kinga does */}
      <section className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500">
          What Kinga Does
        </h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {[
            {
              step: "1. Define",
              desc: "Encode an Anticipatory Action protocol as structured data — hazard, admin unit, indicator, threshold, responsible institution, pre-agreed action.",
            },
            {
              step: "2. Monitor",
              desc: "Continuously evaluate live or synthetic hazard feeds against every defined trigger.",
            },
            {
              step: "3. Anticipate",
              desc: "A statistical forecast model predicts whether a threshold is likely to be crossed in the next 7–14 days, giving extra lead time before the hard trigger fires.",
            },
            {
              step: "4. Activate",
              desc: "When a trigger fires, dispatch the pre-agreed action checklist to the responsible institution via a resilient mesh relay.",
            },
            {
              step: "5. Track",
              desc: "Log every dispatch, delivery hop, and acknowledgment. Flag institutions trending toward a delayed response.",
            },
            {
              step: "6. Show",
              desc: "A God's View Situation Room dashboard displays trigger state per admin unit, threshold gauges, activation timeline, and institutional scorecard.",
            },
          ].map(({ step, desc }) => (
            <div key={step} className="rounded border border-slate-800 bg-slate-900/50 p-3">
              <div className="text-xs font-bold text-sky-300">{step}</div>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Architecture */}
      <section className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500">
          Architecture
        </h2>
        <div className="mt-3 font-mono text-xs leading-relaxed text-slate-400">
          <pre className="overflow-x-auto">{`┌─────────────────────────────────────────────────────┐
│ 1. DATA INGESTION                                    │
│    Rainfall, river gauge, NDVI, IPC, forecasts        │
└────────────────────────┬────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│ 2. TRIGGER ENGINE                                    │
│    Rules evaluator (hard thresholds)                 │
│    + Statistical forecast (7-14 day soft prediction)   │
└────────────────────────┬────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│ 3. ACTIVATION ORCHESTRATOR                           │
│    On trigger fire: action checklist → dispatch      │
└───────────────┬──────────────────────┬──────────────┘
                ↓                      ↓
┌────────────────────────┐  ┌────────────────────────┐
│ 4a. MESH RELAY NETWORK │  │ 4b. RESPONSE TRACKING  │
│     Hop-to-hop delivery│  │     Timestamps + anomaly│
│     to last-mile areas │  │     model flags slow    │
└────────────┬───────────┘  └────────────┬───────────┘
             ↓                           ↓
┌─────────────────────────────────────────────────────┐
│ 5. SITUATION ROOM DASHBOARD ("God's view")            │
│    Trigger map · Gauges · Timeline · Scorecard        │
└─────────────────────────────────────────────────────┘`}</pre>
        </div>
      </section>

      {/* Tech stack */}
      <section className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500">
          Tech Stack
        </h2>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {[
            { layer: "Backend API", tech: "FastAPI (Python)" },
            {
              layer: "Anticipation Model",
              tech: "Statistical trend extrapolation + arming probability",
            },
            { layer: "Mesh Simulation", tech: "NetworkX graph" },
            { layer: "Frontend", tech: "TanStack Start + React 19 + Three.js" },
            { layer: "Data Pipeline", tech: "Pandas / NumPy synthetic generator" },
            { layer: "Styling", tech: "Tailwind CSS v4 + Radix UI" },
          ].map(({ layer, tech }) => (
            <div
              key={layer}
              className="flex items-center justify-between rounded border border-slate-800 bg-slate-900/40 px-3 py-2 text-xs"
            >
              <span className="text-slate-400">{layer}</span>
              <span className="font-mono text-sky-300">{tech}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Data sources */}
      <section className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500">
          Data Sources (Real-Deployment Swap-in Points)
        </h2>
        <div className="mt-3 space-y-2">
          {[
            { signal: "Rainfall (historical)", source: "CHIRPS v3 via Google Earth Engine" },
            { signal: "Rainfall (near-real-time)", source: "NASA/JAXA IMERG (~4h lag)" },
            { signal: "River discharge", source: "GloFAS (Copernicus)" },
            { signal: "NDVI / vegetation", source: "MODIS MOD13Q1 via Earth Engine" },
            { signal: "Soil moisture", source: "NASA POWER API (free, no key)" },
            { signal: "IPC phase", source: "IPC Global Partnership (manual seed)" },
            { signal: "Seasonal forecast", source: "ICPAC EarlyWarning4IGAD bulletins" },
          ].map(({ signal, source }) => (
            <div
              key={signal}
              className="flex items-center justify-between rounded border border-slate-800 bg-slate-900/40 px-3 py-2 text-xs"
            >
              <span className="text-slate-400">{signal}</span>
              <span className="font-mono text-sky-300">{source}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[10px] leading-relaxed text-slate-600">
          The hackathon demo runs entirely on synthetic data generated to match these schemas, so it
          works offline. These are the documented integration points for production deployment.
        </p>
      </section>

      {/* Built for */}
      <section className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500">
          Built For
        </h2>
        <p className="mt-3 text-sm text-slate-300">
          IGAD Hackathon 2026 — "From Warning to Action"
        </p>
        <p className="mt-1 text-xs text-slate-500">
          IGAD is the Intergovernmental Authority on Development, comprising Djibouti, Eritrea,
          Ethiopia, Kenya, Somalia, South Sudan, Sudan, and Uganda.
        </p>
      </section>

      {/* Pitch */}
      <section className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-5">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-sky-400">
          One-Sentence Pitch
        </h2>
        <p className="mt-3 text-sm italic leading-relaxed text-slate-200">
          IGAD is currently paying a consultant to manually reconstruct anticipatory-action trigger
          and activation data across 8 member states, 2020–2025. Kinga is the system that generates
          that data automatically, going forward — and tells you which institution in the chain is
          the bottleneck before it costs lives.
        </p>
      </section>
    </div>
  );
}
