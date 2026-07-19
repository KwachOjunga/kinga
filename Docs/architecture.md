# Architecture

## 1. Overview

Kinga has five layers. Each maps to a specific documented gap (see `PROBLEM_STATEMENT.md`) rather than to a generic "AI + dashboard" template.

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. DATA INGESTION                                                │
│    Rainfall, river gauge, NDVI, IPC phase, seasonal forecasts    │
└───────────────────────────────┬─────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. TRIGGER ENGINE                                                │
│    Rules evaluator (hard thresholds) + LSTM anticipation model   │
│    (soft "arming" forecast, 7–14 day lead time)                  │
└───────────────────────────────┬─────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. ACTIVATION ORCHESTRATOR                                       │
│    On trigger fire: generates action checklist, dispatches to    │
│    responsible institution, requires acknowledgment               │
└───────────────┬─────────────────────────────────┬───────────────┘
                 ↓                                 ↓
┌───────────────────────────────┐   ┌─────────────────────────────┐
│ 4a. MESH RELAY NETWORK          │   │ 4b. RESPONSE TRACKING       │
│     Hop-to-hop delivery to      │   │     Logs dispatch/ack        │
│     areas with degraded/no      │   │     timestamps; anomaly      │
│     cellular connectivity       │   │     model flags slow actors  │
└───────────────┬─────────────────┘   └───────────────┬─────────────┘
                 ↓                                     ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. SITUATION ROOM DASHBOARD ("God's view")                       │
│    Trigger status map · threshold gauges · activation timeline   │
│    · institutional responsiveness scorecard                      │
└─────────────────────────────────────────────────────────────────┘
```

## 2. Layer detail

### 2.1 Data ingestion

Synthetic-first, real-data-ready. The hackathon build generates realistic daily time series (rainfall, river level, NDVI, soil moisture) matching the schema of real sources, so the model and demo work without needing live internet access to external APIs during judging. Swap points for real deployment:

| Signal | Synthetic (hackathon) | Real source |
|---|---|---|
| Rainfall | `generate_synthetic_data.py` | CHIRPS via Google Earth Engine (`UCSB-CHG/CHIRPS/DAILY`) or DE Africa AWS bucket |
| NDVI | `generate_synthetic_data.py` | Earth Engine `MODIS/061/MOD13Q1` |
| River level | `generate_synthetic_data.py` | Kenya WRA HYDATA / national hydrology services |
| Soil moisture | `generate_synthetic_data.py` | NASA POWER API |
| IPC phase | Manually seeded per admin unit | IPC/CH published classifications |
| Seasonal forecast probability | Manually seeded | ICPAC seasonal forecasts (EarlyWarning4IGAD) |

### 2.2 Trigger engine

Two components working together, not one replacing the other:

- **Rules evaluator** — deterministic. Every trigger is a structured record (see `TRIGGER_SCHEMA.md`): hazard, admin unit, one or more indicator/operator/threshold conditions (ANDed), the action to fire, and the responsible institution. This is the part that gives Kinga an audit trail: a trigger either fired against a documented threshold or it didn't, with no ambiguity.
- **LSTM anticipation model** — probabilistic. Trained on the time-series data, it forecasts the probability that a given indicator will cross its threshold in the next 7–14 days. This produces the dashboard's "arming" state — a soft early signal layered on top of the hard rule, giving response teams extra lead time without weakening the auditability of the hard trigger itself.

### 2.3 Activation orchestrator

On a hard trigger firing, the orchestrator:
1. Looks up the pre-agreed action and responsible institution for that trigger.
2. Generates a structured checklist message.
3. Dispatches it via the delivery layer (4a).
4. Opens an acknowledgment window and starts a response-time clock (4b).

### 2.4a Mesh relay network

A graph-based simulation (NetworkX) modeling villages/field offices as nodes and radio range as edges. Messages hop node-to-node toward a gateway with cellular/internet access, with realistic per-hop latency and node-dropout modeling. This is what makes delivery resilient to a downed cell tower or an offline relay — exactly the situation most likely to coincide with the hazard itself. See the mesh topology diagram in the design assets for the visual model (gateway → relay → destination, with automatic rerouting around an offline node).

### 2.4b Response tracking

Every dispatch, hop, delivery, and acknowledgment is timestamped and stored. A second, smaller model (gradient-boosted or simple statistical baseline for the hackathon build) is trained on historical response-time patterns per institution and flags accounts trending toward a delayed acknowledgment before the deadline passes, so the system can auto-escalate to a backup contact.

### 2.5 Situation Room dashboard

Four panels:
- **Trigger status map** — every admin unit colored by state: dormant → arming → triggered → activated → confirmed.
- **Threshold gauges** — live indicator value vs. defined threshold, per trigger, for the selected unit.
- **Activation timeline** — scrub through any past event end-to-end.
- **Institutional responsiveness scorecard** — average time-to-acknowledge and time-to-action per institution, colored on-track / slow / overdue.

## 3. Tech stack

| Component | Choice | Why |
|---|---|---|
| Backend API | FastAPI (Python) | Fast to build, async-friendly, auto-generates OpenAPI docs for the judging panel |
| Anticipation model | TensorFlow/Keras LSTM | Standard, well-documented, appropriate for short multivariate time series |
| Mesh simulation | NetworkX | Graph modeling and shortest-path/relay logic without needing physical LoRa hardware |
| Dashboard | Single-file HTML/CSS/JS + Leaflet-style SVG map | No build step required, fast to demo, easy to iterate under time pressure |
| Data | Pandas/NumPy synthetic generator | Removes dependency on live internet access to external geospatial APIs during judging |

## 4. What's out of scope for the 12-day build

- Real-time integration with live CHIRPS/IPC/ICPAC feeds (documented as a swap-in point, not built live, due to network/API-key constraints during the hackathon)
- Physical LoRa hardware (the mesh layer is simulated in software; hardware is a stretch goal — see `ROADMAP.md`)
- Multi-country production authentication/authorization for real institutional users
- SMS/USSD gateway integration with a live telecom provider (mocked for the demo; see `DATA_SOURCES.md` for the Africa's Talking sandbox integration path)