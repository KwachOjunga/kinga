from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

TriggerStatus = Literal["dormant", "arming", "triggered", "activated", "confirmed"]
ConditionLogic = Literal["AND", "OR"]
ScorecardStatus = Literal["on_track", "slow", "overdue"]


class OfflineBody(BaseModel):
    node_ids: list[str] = Field(default_factory=list)


class Condition(BaseModel):
    indicator: str
    operator: Literal[">=", ">", "<=", "<", "=="]
    threshold: float
    unit: str
    rationale: str | None = None
    current_value: float | None = None


class Action(BaseModel):
    action_id: str
    description: str
    budget_envelope_usd: float


class Institution(BaseModel):
    name: str
    contact_channel: str
    escalation_contact: str


class CommunityBroadcast(BaseModel):
    enabled: bool = True
    contact_list_id: str
    language: list[str]
    message_template: str = "short_non_technical"
    feedback_channel: str = "ussd_ack"


class Trigger(BaseModel):
    trigger_id: str
    country: str
    admin_unit: str
    hazard: Literal["drought", "flood"]
    conditions: list[Condition]
    condition_logic: ConditionLogic = "AND"
    action: Action
    responsible_institution: Institution
    community_broadcast: CommunityBroadcast | None = None
    acknowledgment_deadline_hours: int = 6
    status: TriggerStatus = "dormant"
    lat: float = 0.0
    lon: float = 0.0
    arming_probability: float = 0.0


class TriggerSummary(BaseModel):
    trigger_id: str
    country: str
    admin_unit: str
    hazard: str
    status: TriggerStatus
    conditions: list[Condition]


class ForecastPoint(BaseModel):
    day: int
    indicator: str
    predicted_value: float
    confidence: float


class PredictionResponse(BaseModel):
    admin_unit: str
    forecast: list[ForecastPoint]


class DispatchResponse(BaseModel):
    dispatch_id: str
    trigger_id: str
    dispatched_at: datetime
    delivery_route: list[str]


class AcknowledgeBody(BaseModel):
    acknowledged_by: str
    action_taken: bool = True
    notes: str | None = None


class CommunityAckBody(BaseModel):
    acknowledged_by: str
    received: bool = True
    action_taken: bool | None = None


class MeshNode(BaseModel):
    id: str
    label: str
    lat: float
    lon: float
    role: Literal["gateway", "relay", "destination"] = "relay"


class MeshEdge(BaseModel):
    source: str
    target: str
    latency_ms: int


class MeshTopology(BaseModel):
    nodes: list[MeshNode]
    edges: list[MeshEdge]


class MeshNodeStatus(BaseModel):
    id: str
    online: bool
    last_seen: datetime


class MeshSimulateBody(BaseModel):
    dispatch_id: str | None = None
    destination: str | None = None
    force_offline: list[str] = Field(default_factory=list)


class MeshHop(BaseModel):
    node: str
    arrived_at: datetime
    latency_ms: int


class MeshSimulateResponse(BaseModel):
    dispatch_id: str
    route: list[str]
    hops: list[MeshHop]
    total_latency_ms: int
    delivered: bool


class ScorecardEntry(BaseModel):
    institution: str
    avg_ack_hours: float
    status: ScorecardStatus


class TimelineEvent(BaseModel):
    t: datetime
    label: str
    stage: Literal["ingest", "armed", "trigger", "mesh", "inst_ack", "comm_ack"]
    trigger_id: str | None = None
