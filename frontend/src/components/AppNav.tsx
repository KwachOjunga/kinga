import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { formatEatClock } from "../lib/datetime";

const NAV = [
  { to: "/", label: "God's View" },
  { to: "/triggers", label: "Triggers" },
  { to: "/predictions", label: "Forecasts" },
  { to: "/regions", label: "Regions" },
  { to: "/mesh", label: "Mesh" },
  { to: "/dispatches", label: "Dispatches" },
  { to: "/activations", label: "Activations" },
  { to: "/scorecard", label: "Scorecard" },
  { to: "/institutions", label: "Institutions" },
  { to: "/about", label: "About" },
] as const;

export function AppNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [clock, setClock] = useState(formatEatClock());

  useEffect(() => {
    const tick = () => setClock(formatEatClock());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <nav className="flex items-center justify-between border-b border-slate-800 bg-slate-950/90 px-4 py-2">
      <div className="flex items-center gap-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-sky-500/40 bg-sky-500/10 text-sm font-bold text-sky-400">
            K
          </div>
          <span className="text-sm font-bold tracking-[0.2em] text-sky-300">KINGA</span>
        </Link>
        <div className="flex shrink gap-1 overflow-x-auto">
          {NAV.map(({ to, label }) => {
            const active = pathname === to || (to !== "/" && pathname.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                className={`whitespace-nowrap rounded border px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest transition ${
                  active
                    ? "border-sky-500/40 bg-sky-500/15 text-sky-200"
                    : "border-transparent text-slate-500 hover:text-slate-300"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </div>
      <div className="text-right font-mono text-xs">
        <div className="text-slate-200">{clock.time}</div>
        <div className="text-[10px] uppercase tracking-widest text-slate-500">{clock.date}</div>
      </div>
    </nav>
  );
}
