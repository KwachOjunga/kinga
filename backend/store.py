from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from mesh.simulator import MeshSimulator
from model.anticipation import ARMING_THRESHOLD, arming_probability, forecast_for_admin_unit
from model.evaluator import evaluate_trigger, update_trigger_conditions
from model.generate_synthetic_data import save_time_series
from schemas import (
    AcknowledgeBody,
    CommunityAckBody,
    DispatchResponse,
    MeshSimulateBody,
    MeshSimulateResponse,
    ScorecardEntry,
    TimelineEvent,
)

DATA_DIR = Path(__file__).resolve().parent / "data"
SEED_PATH = DATA_DIR / "seed_triggers.json"


class KingaStore:
    def __init__(self) -> None:
        save_time_series()
        self.mesh = MeshSimulator()
        self.triggers: dict[str, dict] = {}
        self.dispatches: dict[str, dict] = {}
        self.institutional_acks: dict[str, dict] = {}
        self.community_acks: dict[str, dict] = {}
        self.timeline: list[dict] = []
        self._load_triggers()
        self._seed_scorecard_history()
        self.refresh_all_triggers()

    def _load_triggers(self) -> None:
        with SEED_PATH.open() as f:
            for row in json.load(f):
                self.triggers[row["trigger_id"]] = row

    def _seed_scorecard_history(self) -> None:
        now = datetime.now(timezone.utc)
        self.timeline.extend(
            [
                {
                    "t": (now).isoformat(),
                    "label": "IMERG rainfall ingest · Marsabit",
                    "stage": "ingest",
                    "trigger_id": "KE-MSB-DROUGHT-01",
                },
                {
                    "t": (now).isoformat(),
                    "label": "Model armed KE-MSB-DROUGHT-01 (P=0.72)",
                    "stage": "armed",
                    "trigger_id": "KE-MSB-DROUGHT-01",
                },
            ]
        )

    def _add_timeline(
        self,
        label: str,
        stage: str,
        trigger_id: str | None = None,
    ) -> None:
        self.timeline.append(
            {
                "t": datetime.now(timezone.utc).isoformat(),
                "label": label,
                "stage": stage,
                "trigger_id": trigger_id,
            }
        )

    def refresh_trigger(self, trigger_id: str) -> dict:
        trigger = self.triggers[trigger_id]
        if trigger["status"] in ("activated", "confirmed"):
            trigger = update_trigger_conditions(trigger)
            self.triggers[trigger_id] = trigger
            return trigger

        trigger = update_trigger_conditions(trigger)
        fired, _ = evaluate_trigger(trigger)
        prob = arming_probability(trigger)
        trigger["arming_probability"] = prob

        if fired and trigger["status"] not in ("triggered", "activated", "confirmed"):
            trigger["status"] = "triggered"
            self._add_timeline(
                f"HARD TRIGGER · {trigger_id} breached ({trigger['hazard']})",
                "trigger",
                trigger_id,
            )
        elif prob >= ARMING_THRESHOLD and trigger["status"] == "dormant":
            trigger["status"] = "arming"
            self._add_timeline(
                f"Model armed {trigger_id} (P={prob:.2f})",
                "armed",
                trigger_id,
            )
        elif prob < ARMING_THRESHOLD and trigger["status"] == "arming" and not fired:
            trigger["status"] = "dormant"

        self.triggers[trigger_id] = trigger
        return trigger

    def refresh_all_triggers(self) -> None:
        for trigger_id in list(self.triggers):
            self.refresh_trigger(trigger_id)

    def list_triggers(
        self,
        country: str | None = None,
        hazard: str | None = None,
        status: str | None = None,
    ) -> list[dict]:
        self.refresh_all_triggers()
        rows = list(self.triggers.values())
        if country:
            rows = [r for r in rows if r["country"].lower() == country.lower()]
        if hazard:
            rows = [r for r in rows if r["hazard"].lower() == hazard.lower()]
        if status:
            rows = [r for r in rows if r["status"] == status]
        return rows

    def get_trigger(self, trigger_id: str) -> dict | None:
        if trigger_id not in self.triggers:
            return None
        return self.refresh_trigger(trigger_id)

    def create_trigger(self, payload: dict) -> dict:
        trigger_id = payload["trigger_id"]
        if trigger_id in self.triggers:
            raise ValueError(f"Trigger {trigger_id} already exists")
        payload.setdefault("status", "dormant")
        payload.setdefault("arming_probability", 0.0)
        self.triggers[trigger_id] = payload
        return self.refresh_trigger(trigger_id)

    def predict(self, admin_unit: str) -> dict:
        indicators: set[str] = set()
        for trigger in self.triggers.values():
            if trigger["admin_unit"] == admin_unit:
                for cond in trigger["conditions"]:
                    indicators.add(cond["indicator"])
        forecast = forecast_for_admin_unit(admin_unit, sorted(indicators))
        return {"admin_unit": admin_unit, "forecast": forecast}

    def activate(self, trigger_id: str) -> DispatchResponse:
        trigger = self.get_trigger(trigger_id)
        if trigger is None:
            raise KeyError(trigger_id)

        if trigger["status"] not in ("triggered", "arming", "activated"):
            trigger["status"] = "triggered"

        dispatch_id = f"d-{uuid.uuid4().hex[:8]}"
        destination = self.mesh.destination_for_trigger(trigger_id)
        sim = self.mesh.simulate_delivery(dispatch_id, destination=destination)

        now = datetime.now(timezone.utc)
        dispatch = {
            "dispatch_id": dispatch_id,
            "trigger_id": trigger_id,
            "dispatched_at": now,
            "delivery_route": sim["route"],
            "hops": sim["hops"],
            "delivered": sim["delivered"],
        }
        self.dispatches[dispatch_id] = dispatch
        trigger["status"] = "activated"
        self.triggers[trigger_id] = trigger

        self._add_timeline(
            f"Mesh relay dispatched via {sim['route'][0] if sim['route'] else 'gateway'}",
            "mesh",
            trigger_id,
        )
        return DispatchResponse(
            dispatch_id=dispatch_id,
            trigger_id=trigger_id,
            dispatched_at=now,
            delivery_route=sim["route"],
        )

    def acknowledge(self, dispatch_id: str, body: AcknowledgeBody) -> dict:
        dispatch = self.dispatches.get(dispatch_id)
        if dispatch is None:
            raise KeyError(dispatch_id)

        now = datetime.now(timezone.utc)
        ack = {
            "dispatch_id": dispatch_id,
            "acknowledged_by": body.acknowledged_by,
            "action_taken": body.action_taken,
            "notes": body.notes,
            "acknowledged_at": now,
            "type": "institutional",
        }
        self.institutional_acks[dispatch_id] = ack
        trigger_id = dispatch["trigger_id"]
        trigger = self.triggers[trigger_id]

        self._add_timeline(
            f"Institutional ACK · {trigger_id}",
            "inst_ack",
            trigger_id,
        )

        if body.action_taken and trigger.get("community_broadcast", {}).get("enabled"):
            community_dispatch_id = f"{dispatch_id}-comm"
            dest = self.mesh.destination_for_trigger(trigger_id)
            self.mesh.simulate_delivery(community_dispatch_id, destination=dest)
            self._add_timeline(
                f"Community broadcast fan-out · {trigger_id}",
                "mesh",
                trigger_id,
            )

        return ack

    def acknowledge_community(self, dispatch_id: str, body: CommunityAckBody) -> dict:
        dispatch = self.dispatches.get(dispatch_id)
        if dispatch is None:
            raise KeyError(dispatch_id)

        now = datetime.now(timezone.utc)
        ack = {
            "dispatch_id": dispatch_id,
            "acknowledged_by": body.acknowledged_by,
            "received": body.received,
            "action_taken": body.action_taken,
            "acknowledged_at": now,
            "type": "community",
        }
        self.community_acks[dispatch_id] = ack
        trigger_id = dispatch["trigger_id"]
        trigger = self.triggers[trigger_id]
        trigger["status"] = "confirmed"
        self.triggers[trigger_id] = trigger

        self._add_timeline(
            f"Community ACK · {trigger_id}",
            "comm_ack",
            trigger_id,
        )
        return ack

    def simulate_mesh(self, body: MeshSimulateBody) -> MeshSimulateResponse:
        dispatch_id = body.dispatch_id or f"d-sim-{uuid.uuid4().hex[:6]}"
        destination = body.destination
        if not destination and body.dispatch_id:
            dispatch = self.dispatches.get(body.dispatch_id)
            if dispatch:
                destination = self.mesh.destination_for_trigger(
                    dispatch["trigger_id"]
                )
        sim = self.mesh.simulate_delivery(
            dispatch_id,
            destination=destination,
            force_offline=body.force_offline,
        )
        return MeshSimulateResponse(**sim)

    def scorecard(self) -> list[ScorecardEntry]:
        stats: dict[str, list[float]] = {}
        for dispatch_id, ack in self.institutional_acks.items():
            dispatch = self.dispatches.get(dispatch_id)
            if not dispatch:
                continue
            trigger = self.triggers.get(dispatch["trigger_id"])
            if not trigger:
                continue
            inst = trigger["responsible_institution"]["name"]
            delta = (
                ack["acknowledged_at"] - dispatch["dispatched_at"]
            ).total_seconds() / 3600
            stats.setdefault(inst, []).append(delta)

        def _rate(hours: float) -> str:
            if hours <= 3:
                return "on_track"
            if hours <= 6:
                return "slow"
            return "overdue"

        defaults = [
            ("Kenya NDMA, Marsabit sub-office", 0.2),
            ("Ethiopia NDRMC, Dollo border", 14.0),
            ("Kenya NDMA, Turkana sub-office", 0.35),
            ("Somalia DRM, Gedo office", 0.78),
            ("Uganda OPM, Karamoja desk", 1.1),
            ("Djibouti ANDHS, Ali Sabieh desk", 0.65),
            ("Eritrea DMNC, Gash-Barka desk", 2.3),
            ("South Sudan DMC, Jonglei desk", 0.45),
            ("Sudan HAC, Gedaref office", 1.8),
        ]
        entries: list[ScorecardEntry] = []
        seen: set[str] = set()
        for inst, fallback_hours in defaults:
            hours = (
                sum(stats[inst]) / len(stats[inst]) if inst in stats else fallback_hours
            )
            entries.append(
                ScorecardEntry(
                    institution=inst,
                    avg_ack_hours=round(hours, 1),
                    status=_rate(hours),
                )
            )
            seen.add(inst)

        for inst, hours_list in stats.items():
            if inst in seen:
                continue
            hours = sum(hours_list) / len(hours_list)
            entries.append(
                ScorecardEntry(
                    institution=inst,
                    avg_ack_hours=round(hours, 1),
                    status=_rate(hours),
                )
            )
        return entries

    def get_timeline(self, limit: int = 20) -> list[TimelineEvent]:
        rows = self.timeline[-limit:]
        return [
            TimelineEvent(
                t=datetime.fromisoformat(r["t"]),
                label=r["label"],
                stage=r["stage"],
                trigger_id=r.get("trigger_id"),
            )
            for r in rows
        ]

    def latest_dispatch_for_trigger(self, trigger_id: str) -> str | None:
        for dispatch_id, dispatch in reversed(list(self.dispatches.items())):
            if dispatch["trigger_id"] == trigger_id:
                return dispatch_id
        return None


store = KingaStore()
