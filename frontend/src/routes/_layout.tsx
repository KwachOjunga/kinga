import { createFileRoute, Outlet } from "@tanstack/react-router";

import { AppNav } from "../components/AppNav";

export const Route = createFileRoute("/_layout")({
  component: AppLayout,
});

function AppLayout() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#05080f] text-slate-100">
      <AppNav />
      <div className="min-h-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
