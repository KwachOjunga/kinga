/** Kinga backend API types — mirrors Docs/Api-specs.md and trigger-schema.md */

import { ADMIN_COORDS } from "./geo";

export type ApiTriggerStatus = "dormant" | "arming" | "triggered" | "activated" | "confirmed";

export type DashboardNodeStatus = "dormant" | "armed" | "critical" | "confirmed";

export interface ApiCondition {
  indicator: string;
  operator: string;
  threshold: number;
  unit: string;
  rationale?: string;
  current_value?: number;
}

export interface ApiTrigger {
  trigger_id: string;
  country: string;
  admin_unit: string;
  hazard: "drought" | "flood";
  status: ApiTriggerStatus;
  conditions: ApiCondition[];
  condition_logic?: string;
  action?: {
    action_id: string;
    description: string;
    budget_envelope_usd: number;
  };
  responsible_institution?: {
    name: string;
    contact_channel: string;
    escalation_contact: string;
  };
  community_broadcast?: {
    enabled: boolean;
    contact_list_id: string;
    language: string[];
    message_template: string;
    feedback_channel: string;
  };
  acknowledgment_deadline_hours?: number;
  lat?: number;
  lon?: number;
  arming_probability?: number;
}

export interface ApiScorecardEntry {
  institution: string;
  avg_ack_hours: number;
  status: "on_track" | "slow" | "overdue";
}

export interface ApiTimelineEvent {
  t: string;
  label: string;
  stage: "ingest" | "armed" | "trigger" | "mesh" | "inst_ack" | "comm_ack";
  trigger_id?: string;
}

export interface ApiDispatch {
  dispatch_id: string;
  trigger_id: string;
  dispatched_at: string;
  delivery_route: string[];
}

export interface RegionNode {
  id: string;
  label: string;
  area: string;
  hazard: "DROUGHT" | "FLOOD";
  geoLat: number;
  geoLon: number;
  status: DashboardNodeStatus;
  soilMoisture: number;
  rainfallMm: number;
  lagHours: number;
  threshold: number;
  rationale: string;
  probability: number;
  dispatchId?: string;
}

export interface TimelineEvent {
  t: number;
  label: string;
  stage: ApiTimelineEvent["stage"];
}

export function apiStatusToDashboard(status: ApiTriggerStatus): DashboardNodeStatus {
  switch (status) {
    case "arming":
      return "armed";
    case "triggered":
    case "activated":
      return "critical";
    case "confirmed":
      return "confirmed";
    default:
      return "dormant";
  }
}

export function scorecardStatusLabel(status: ApiScorecardEntry["status"]): "OK" | "SLOW" {
  return status === "on_track" ? "OK" : "SLOW";
}

export function triggerToRegionNode(trigger: ApiTrigger): RegionNode {
  const drought = trigger.hazard === "drought";
  const primary = trigger.conditions[0];
  const secondary = trigger.conditions[1];

  const soilMoisture =
    trigger.conditions.find((c) => c.indicator === "soil_moisture_pct")?.current_value ??
    (drought ? 22 : 48);

  const rainfallMm =
    trigger.conditions.find((c) => c.indicator.includes("rainfall"))?.current_value ??
    (drought ? 6 : 12);

  const threshold = primary?.threshold ?? (drought ? 18 : 35);
  const rationale =
    primary?.rationale ??
    trigger.conditions
      .map((c) => c.rationale)
      .filter(Boolean)
      .join(" ") ??
    "Monitoring baseline conditions.";

  const label = trigger.admin_unit.split(" ")[0];

  const fallback = ADMIN_COORDS[trigger.trigger_id] ?? { lat: 2.0, lon: 38.0 };
  const geoLat = trigger.lat != null && Math.abs(trigger.lat) > 1 ? trigger.lat : fallback.lat;
  const geoLon = trigger.lon != null && Math.abs(trigger.lon) > 1 ? trigger.lon : fallback.lon;

  return {
    id: trigger.trigger_id,
    label,
    area: `${trigger.country} · ${label}`,
    hazard: drought ? "DROUGHT" : "FLOOD",
    geoLat,
    geoLon,
    status: apiStatusToDashboard(trigger.status),
    soilMoisture,
    rainfallMm,
    lagHours: drought ? 4 : 2,
    threshold,
    rationale,
    probability: trigger.arming_probability ?? 0.2,
  };
}
