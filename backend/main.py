from __future__ import annotations

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from schemas import (
    AcknowledgeBody,
    CommunityAckBody,
    MeshSimulateBody,
    MeshSimulateResponse,
    MeshTopology,
    OfflineBody,
    PredictionResponse,
    ScorecardEntry,
    TimelineEvent,
    Trigger,
    TriggerSummary,
)
from store import store

app = FastAPI(
    title="Kinga API",
    description="Anticipatory action trigger & activation engine for the IGAD region",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "triggers": len(store.triggers)}


@app.get("/triggers", response_model=list[TriggerSummary])
def list_triggers(
    country: str | None = None,
    hazard: str | None = None,
    status: str | None = None,
) -> list[dict]:
    return store.list_triggers(country=country, hazard=hazard, status=status)


@app.post("/triggers", response_model=Trigger)
def create_trigger(trigger: Trigger) -> dict:
    try:
        return store.create_trigger(trigger.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.get("/triggers/{trigger_id}/dispatch")
def latest_dispatch(trigger_id: str) -> dict:
    dispatch_id = store.latest_dispatch_for_trigger(trigger_id)
    if dispatch_id is None:
        raise HTTPException(status_code=404, detail="No dispatch for trigger")
    dispatch = store.dispatches[dispatch_id]
    hops = [
        hop.model_dump(mode="json") if hasattr(hop, "model_dump") else hop
        for hop in dispatch.get("hops", [])
    ]
    return {
        "dispatch_id": dispatch["dispatch_id"],
        "trigger_id": dispatch["trigger_id"],
        "dispatched_at": dispatch["dispatched_at"].isoformat(),
        "delivery_route": dispatch["delivery_route"],
        "hops": hops,
        "delivered": dispatch.get("delivered", False),
    }


@app.get("/triggers/{trigger_id}", response_model=Trigger)
def get_trigger(trigger_id: str) -> dict:
    trigger = store.get_trigger(trigger_id)
    if trigger is None:
        raise HTTPException(status_code=404, detail="Trigger not found")
    return trigger


@app.get("/predict/{admin_unit}", response_model=PredictionResponse)
def predict(admin_unit: str) -> dict:
    return store.predict(admin_unit)


@app.post("/activate/{trigger_id}")
def activate(trigger_id: str) -> dict:
    try:
        result = store.activate(trigger_id)
        return result.model_dump(mode="json")
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Trigger not found") from exc


@app.post("/acknowledge/{dispatch_id}")
def acknowledge(dispatch_id: str, body: AcknowledgeBody) -> dict:
    try:
        ack = store.acknowledge(dispatch_id, body)
        ack["acknowledged_at"] = ack["acknowledged_at"].isoformat()
        return ack
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Dispatch not found") from exc


@app.post("/acknowledge-community/{dispatch_id}")
def acknowledge_community(dispatch_id: str, body: CommunityAckBody) -> dict:
    try:
        ack = store.acknowledge_community(dispatch_id, body)
        ack["acknowledged_at"] = ack["acknowledged_at"].isoformat()
        return ack
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Dispatch not found") from exc


@app.get("/mesh/topology", response_model=MeshTopology)
def mesh_topology() -> MeshTopology:
    return store.mesh.get_topology()


@app.get("/mesh/status")
def mesh_status() -> list[dict]:
    return [s.model_dump() for s in store.mesh.get_status()]


@app.post("/mesh/simulate", response_model=MeshSimulateResponse)
def mesh_simulate(body: MeshSimulateBody) -> MeshSimulateResponse:
    result = store.simulate_mesh(body)
    return result


@app.get("/institutions/scorecard", response_model=list[ScorecardEntry])
def institutions_scorecard() -> list[ScorecardEntry]:
    return store.scorecard()


@app.get("/timeline", response_model=list[TimelineEvent])
def timeline(limit: int = Query(default=20, le=100)) -> list[TimelineEvent]:
    return store.get_timeline(limit=limit)


@app.post("/mesh/offline")
def mesh_set_offline(body: OfflineBody) -> dict:
    store.mesh.set_offline(body.node_ids)
    return {"offline": list(store.mesh.offline_nodes)}


@app.post("/mesh/online")
def mesh_clear_offline() -> dict:
    store.mesh.clear_offline()
    return {"offline": []}


@app.post("/triggers/refresh")
def refresh_triggers() -> dict:
    store.refresh_all_triggers()
    return {"refreshed": len(store.triggers)}
