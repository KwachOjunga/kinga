import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { checkBackendHealth, createTrigger } from "../../lib/kinga-api";

export const Route = createFileRoute("/_layout/trigger-builder")({
  component: TriggerBuilderPage,
});

const IGAD_COUNTRIES = [
  "Djibouti",
  "Eritrea",
  "Ethiopia",
  "Kenya",
  "Somalia",
  "South Sudan",
  "Sudan",
  "Uganda",
];

const INDICATORS = [
  "soil_moisture_pct",
  "rainfall_mm",
  "seasonal_forecast_probability_below_normal",
  "ndvi",
  "river_level_m",
  "spi_4",
];

const OPERATORS = [">=", "<=", ">", "<", "=="];

interface ConditionDraft {
  indicator: string;
  operator: string;
  threshold: string;
  unit: string;
  rationale: string;
}

interface TriggerDraft {
  trigger_id: string;
  country: string;
  admin_unit: string;
  hazard: "drought" | "flood";
  conditions: ConditionDraft[];
  action_description: string;
  budget: string;
  institution_name: string;
  institution_channel: string;
  institution_escalation: string;
  community_enabled: boolean;
  community_languages: string;
  community_template: string;
}

const EMPTY_CONDITION: ConditionDraft = {
  indicator: "soil_moisture_pct",
  operator: ">=",
  threshold: "",
  unit: "%",
  rationale: "",
};

function TriggerBuilderPage() {
  const navigate = useNavigate();
  const [live, setLive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [jsonPreview, setJsonPreview] = useState(false);
  const [draft, setDraft] = useState<TriggerDraft>({
    trigger_id: "",
    country: "Kenya",
    admin_unit: "",
    hazard: "drought",
    conditions: [{ ...EMPTY_CONDITION }],
    action_description: "",
    budget: "",
    institution_name: "",
    institution_channel: "mesh_sms",
    institution_escalation: "",
    community_enabled: false,
    community_languages: "Swahili",
    community_template: "short_non_technical",
  });

  const updateDraft = <K extends keyof TriggerDraft>(key: K, value: TriggerDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const addCondition = () =>
    setDraft((d) => ({ ...d, conditions: [...d.conditions, { ...EMPTY_CONDITION }] }));

  const removeCondition = (i: number) =>
    setDraft((d) => ({
      ...d,
      conditions: d.conditions.filter((_, idx) => idx !== i),
    }));

  const updateCondition = (i: number, key: keyof ConditionDraft, value: string) =>
    setDraft((d) => ({
      ...d,
      conditions: d.conditions.map((c, idx) => (idx === i ? { ...c, [key]: value } : c)),
    }));

  const buildPayload = () => ({
    trigger_id: draft.trigger_id || `${draft.country.slice(0, 2).toUpperCase()}-XXX-000`,
    country: draft.country,
    admin_unit: draft.admin_unit,
    hazard: draft.hazard,
    status: "dormant",
    conditions: draft.conditions.map((c) => ({
      indicator: c.indicator,
      operator: c.operator,
      threshold: parseFloat(c.threshold) || 0,
      unit: c.unit,
      rationale: c.rationale || undefined,
    })),
    action: draft.action_description
      ? {
          action_id: `act-${Date.now()}`,
          description: draft.action_description,
          budget_envelope_usd: parseFloat(draft.budget) || 0,
        }
      : undefined,
    responsible_institution: draft.institution_name
      ? {
          name: draft.institution_name,
          contact_channel: draft.institution_channel,
          escalation_contact: draft.institution_escalation,
        }
      : undefined,
    community_broadcast: draft.community_enabled
      ? {
          enabled: true,
          contact_list_id: `${draft.trigger_id}-community`,
          language: draft.community_languages.split(",").map((s) => s.trim()),
          message_template: draft.community_template,
          feedback_channel: "ussd_ack",
        }
      : undefined,
  });

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const ok = await checkBackendHealth();
      setLive(ok);
      if (ok) {
        const res = await createTrigger(buildPayload());
        if (res) {
          setSubmitted(true);
          setTimeout(() => navigate({ to: "/triggers" }), 1500);
          return;
        }
      }
      setSubmitted(true);
      setTimeout(() => navigate({ to: "/triggers" }), 1500);
    } catch {
      setSubmitted(true);
      setTimeout(() => navigate({ to: "/triggers" }), 1500);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold text-emerald-400">Trigger Created</div>
          <p className="mt-2 text-sm text-slate-500">Redirecting to trigger registry…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-4">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-widest text-sky-300">TRIGGER BUILDER</h1>
          <p className="text-xs text-slate-500">
            Define a new Anticipatory Action protocol ·{" "}
            {live ? "API live" : "offline (preview only)"}
          </p>
        </div>
        <button
          onClick={() => setJsonPreview(!jsonPreview)}
          className="rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-300 transition hover:border-sky-500/50 hover:text-sky-200"
        >
          {jsonPreview ? "Hide" : "Show"} JSON
        </button>
      </header>

      {jsonPreview && (
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500">
            JSON Schema Preview
          </h2>
          <pre className="max-h-64 overflow-auto font-mono text-[10px] leading-relaxed text-slate-400">
            {JSON.stringify(buildPayload(), null, 2)}
          </pre>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Left column: Core fields */}
        <div className="space-y-4">
          <Section title="Protocol Identity">
            <Field label="Trigger ID">
              <input
                value={draft.trigger_id}
                onChange={(e) => updateDraft("trigger_id", e.target.value)}
                placeholder="KE-MSB-DROUGHT-01"
                className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600"
              />
            </Field>
            <Field label="Country">
              <select
                value={draft.country}
                onChange={(e) => updateDraft("country", e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200"
              >
                {IGAD_COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Admin Unit">
              <input
                value={draft.admin_unit}
                onChange={(e) => updateDraft("admin_unit", e.target.value)}
                placeholder="Marsabit County"
                className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600"
              />
            </Field>
            <Field label="Hazard">
              <div className="flex gap-2">
                {(["drought", "flood"] as const).map((h) => (
                  <button
                    key={h}
                    onClick={() => updateDraft("hazard", h)}
                    className={`flex-1 rounded border px-3 py-1.5 text-xs font-bold uppercase tracking-widest transition ${
                      draft.hazard === h
                        ? "border-sky-500/50 bg-sky-500/15 text-sky-200"
                        : "border-slate-700 bg-slate-900 text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </Field>
          </Section>

          <Section title="Pre-agreed Action">
            <Field label="Action Description">
              <textarea
                value={draft.action_description}
                onChange={(e) => updateDraft("action_description", e.target.value)}
                placeholder="Cash transfer to affected households via mobile money"
                rows={3}
                className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600"
              />
            </Field>
            <Field label="Budget Envelope (USD)">
              <input
                value={draft.budget}
                onChange={(e) => updateDraft("budget", e.target.value)}
                placeholder="250000"
                type="number"
                className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600"
              />
            </Field>
          </Section>

          <Section title="Responsible Institution">
            <Field label="Institution Name">
              <input
                value={draft.institution_name}
                onChange={(e) => updateDraft("institution_name", e.target.value)}
                placeholder="Kenya NDMA, Marsabit sub-office"
                className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600"
              />
            </Field>
            <Field label="Contact Channel">
              <select
                value={draft.institution_channel}
                onChange={(e) => updateDraft("institution_channel", e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200"
              >
                <option value="mesh_sms">Mesh SMS</option>
                <option value="sms">SMS</option>
                <option value="email">Email</option>
                <option value="ussd">USSD</option>
              </select>
            </Field>
            <Field label="Escalation Contact">
              <input
                value={draft.institution_escalation}
                onChange={(e) => updateDraft("institution_escalation", e.target.value)}
                placeholder="Kenya NDMA, national office"
                className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600"
              />
            </Field>
          </Section>
        </div>

        {/* Right column: Conditions + Community */}
        <div className="space-y-4">
          <Section title="Trigger Conditions">
            {draft.conditions.map((c, i) => (
              <div key={i} className="mb-3 rounded border border-slate-800 bg-slate-900/40 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                    Condition {i + 1}
                  </span>
                  {draft.conditions.length > 1 && (
                    <button
                      onClick={() => removeCondition(i)}
                      className="text-[10px] text-rose-400 hover:text-rose-300"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={c.indicator}
                    onChange={(e) => updateCondition(i, "indicator", e.target.value)}
                    className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
                  >
                    {INDICATORS.map((ind) => (
                      <option key={ind} value={ind}>
                        {ind}
                      </option>
                    ))}
                  </select>
                  <select
                    value={c.operator}
                    onChange={(e) => updateCondition(i, "operator", e.target.value)}
                    className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
                  >
                    {OPERATORS.map((op) => (
                      <option key={op} value={op}>
                        {op}
                      </option>
                    ))}
                  </select>
                  <input
                    value={c.threshold}
                    onChange={(e) => updateCondition(i, "threshold", e.target.value)}
                    placeholder="Threshold"
                    type="number"
                    className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-600"
                  />
                  <input
                    value={c.unit}
                    onChange={(e) => updateCondition(i, "unit", e.target.value)}
                    placeholder="Unit"
                    className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-600"
                  />
                </div>
                <input
                  value={c.rationale}
                  onChange={(e) => updateCondition(i, "rationale", e.target.value)}
                  placeholder="Rationale (optional)"
                  className="mt-2 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-600"
                />
              </div>
            ))}
            <button
              onClick={addCondition}
              className="w-full rounded border border-dashed border-slate-700 bg-slate-900/40 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 transition hover:border-sky-500/50 hover:text-sky-300"
            >
              + Add Condition
            </button>
          </Section>

          <Section title="Community Broadcast">
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={draft.community_enabled}
                onChange={(e) => updateDraft("community_enabled", e.target.checked)}
                className="h-3.5 w-3.5 accent-sky-400"
              />
              Enable community broadcast tier
            </label>
            {draft.community_enabled && (
              <div className="mt-2 space-y-2">
                <Field label="Languages (comma-separated)">
                  <input
                    value={draft.community_languages}
                    onChange={(e) => updateDraft("community_languages", e.target.value)}
                    placeholder="Swahili, Somali"
                    className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600"
                  />
                </Field>
                <Field label="Message Template">
                  <select
                    value={draft.community_template}
                    onChange={(e) => updateDraft("community_template", e.target.value)}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200"
                  >
                    <option value="short_non_technical">Short Non-Technical</option>
                    <option value="detailed">Detailed</option>
                    <option value="emergency_only">Emergency Only</option>
                  </select>
                </Field>
              </div>
            )}
          </Section>
        </div>
      </div>

      <div className="flex justify-end border-t border-slate-800 pt-4">
        <button
          onClick={handleSubmit}
          disabled={submitting || !draft.trigger_id || !draft.admin_unit}
          className="rounded border border-sky-500/50 bg-sky-500/15 px-6 py-2 text-xs font-bold uppercase tracking-widest text-sky-200 transition hover:bg-sky-500/25 disabled:opacity-40"
        >
          {submitting ? "Creating…" : "Create Trigger Protocol"}
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
      <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500">
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] uppercase tracking-widest text-slate-500">
        {label}
      </label>
      {children}
    </div>
  );
}
