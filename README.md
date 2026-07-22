# Kinga — Anticipatory Action Trigger & Activation Engine

> **IGAD Hackathon 2026** · Horn of Africa · *From Early Warning to Early Action*

Kinga closes the gap between **climate prediction** and **humanitarian action**. It monitors environmental indicators, fires automated triggers when thresholds are breached, dispatches pre-agreed action plans through a resilient mesh relay network, and tracks institutional response in real-time — all the way down to community acknowledgment via basic feature phones.

---

## The Problem

> *"ICPAC has identified critical gaps in preparedness. Countries define triggers on paper but lack the technology to connect early warnings to pre-arranged action plans."*

In the Horn of Africa, climate early warnings exist but rarely translate into timely action. When a drought or flood is forecast:
- Alerts sit in email inboxes
- Coordination is ad-hoc
- No one tracks whether action was actually taken
- Communities at risk wait until disaster strikes

**Kinga fixes this.** It is an end-to-end digital pipeline from sensor → trigger → dispatch → acknowledgment → action.

---

## The Solution — 6-Step Workflow

```
┌─────────┐   ┌─────────┐   ┌──────────┐   ┌──────────┐   ┌─────────┐   ┌─────────┐
│  DEFINE  │ → │ MONITOR │ → │ANTICIPATE│ → │ ACTIVATE │ → │  TRACK  │ → │  SHOW   │
│ Protocol │   │  God's  │   │Prediction│   │  Mesh    │   │Dispatch │   │Scorecard│
│          │   │  View   │   │  Charts  │   │  Relay   │   │ + Ack   │   │   +     │
│          │   │         │   │          │   │          │   │Timeline │   │Timeline │
└─────────┘   └─────────┘   └──────────┘   └──────────┘   └─────────┘   └─────────┘
```

### 1. Define
Create anticipatory action protocols via the **Trigger Builder**: country, admin unit, hazard type, threshold conditions, pre-agreed action plan, budget envelope, responsible institution, and community broadcast settings.

### 2. Monitor
**God's View** — a 3D situation room built with Three.js showing all triggers as color-coded beacon nodes on a Horn of Africa map. Procedural terrain, country outlines, and animated data-flow particles provide real-time situational awareness.

### 3. Anticipate
Statistical forecast viewer with 14-day linear trend projections for each indicator. Shows when and whether thresholds will be breached, with decaying confidence bands.

### 4. Activate
When conditions are met, a human clicks **"FORCE TRIGGER"** which:
1. Creates a dispatch record with a unique ID
2. Simulates mesh network delivery from the nearest gateway to the target field office
3. Logs every hop with latency and arrival timestamps

### 5. Track
- **Dispatch Log**: hop-by-hop delivery records with timestamps
- **Activation Timeline**: 6-stage event replay (INGEST → ARMED → TRIGGER → MESH → INST ACK → COMM ACK)
- **USSD Phone Mock**: simulates a field agent receiving and confirming the alert on a basic feature phone (*789#)

### 6. Show
- **Institution Scorecard**: average acknowledgment time per institution (on_track ≤3h, slow ≤6h, overdue >6h)
- **Institution Deep Dive**: per-organisation accountability with assigned triggers, budgets, and escalation contacts

---

## Trigger Lifecycle

```
dormant ──→ arming ──→ triggered ──→ activated ──→ confirmed
   ↑            │            │
   └────────────┘            │
   (prob drops)              └── (user activates)
```

| State | Meaning |
|---|---|
| **dormant** | Normal monitoring. No risk detected. |
| **arming** | Arming probability > 50%. Watching closely. |
| **triggered** | Threshold breached. System says "act now." |
| **activated** | Human confirmed. Dispatch sent via mesh network. |
| **confirmed** | Community acknowledged receipt via USSD. Terminal state. |

---

## Seed Triggers (8 IGAD Countries)

| Trigger | Country | Admin Unit | Hazard | Budget |
|---|---|---|---|---|
| `KE-MSB-DROUGHT-01` | Kenya | Marsabit County | Drought | $250,000 |
| `ET-SOM-DROUGHT-02` | Ethiopia | Somali Region | Drought | $120,000 |
| `KE-TRK-DROUGHT-03` | Kenya | Turkana County | Drought | $80,000 |
| `SO-GED-FLOOD-04` | Somalia | Gedo | Flood | $90,000 |
| `UG-KAR-FLOOD-05` | Uganda | Karamoja | Flood | $60,000 |
| `DJ-ALI-DROUGHT-06` | Djibouti | Ali Sabieh Region | Drought | $75,000 |
| `ER-GBR-DROUGHT-07` | Eritrea | Gash-Barka Region | Drought | $65,000 |
| `SS-JON-FLOOD-08` | South Sudan | Jonglei State | Flood | $110,000 |
| `SD-GED-DROUGHT-09` | Sudan | Gedaref State | Drought | $95,000 |

**Total budget envelope: $845,000**

### Example Conditions

- **Drought triggers**: `soil_moisture_pct < 18%` (often with `seasonal_forecast_probability_below_normal >= 0.6`)
- **Flood triggers**: `rainfall_mm_3h > 35mm` or `river_level_m > 11.5m AND rainfall_mm_3h > 40mm`
- **Logic**: AND (all conditions must fire) or OR (any condition fires)
- Each trigger has an `arming_probability` computed from 7-day forecast proximity to threshold

---

## Mesh Relay Network

An IoT mesh network simulation for delivering alerts to field offices when conventional infrastructure fails.

### Topology

```
                    ┌──────────────────┐
                    │  Nairobi Gateway │─── Gedaref (Sudan)
                    │  (gateway_01)    │─── Jonglei (South Sudan)
                    └────────┬─────────┘─── Turkana (Kenya)
                             │             Marsabit (Kenya)
                    ┌────────┴─────────┐
                    │  Marsabit Relay  │
                    │  (village_a)     │
                    └────────┬─────────┘
                             │
                    ┌────────┴─────────┐
                    │  Dire Dawa Relay │─── Gash-Barka (Eritrea)
                    │  (village_b)     │
                    └────────┬─────────┘
                             │
                    ┌────────┴─────────┐
                    │  Jijiga Relay    │─── Gedo (Somalia)
                    │  (village_c)     │─── Ali Sabieh (Djibouti)
                    └──────────────────┘─── Dollo (Ethiopia)
                                          Karamoja (Uganda)
```

- **14 nodes**: 2 gateways, 3 relays, 9 field office destinations
- **24 edges** with latencies from 70–220ms
- **Routing**: Dijkstra shortest path (NetworkX), automatically reroutes around offline nodes
- **Jitter**: 10–80ms random delay per hop for realism
- **Fault tolerance**: toggle any node offline and re-run simulation to see path adaptation

---

## Forecasting Engine (Statistical, not ML)

No machine learning. The prediction model uses **linear trend extrapolation**:

1. Take 30 days of history for an indicator
2. Compute the slope from the last 7 days
3. Project forward: `predicted = current + trend × day`
4. Confidence decays with time and volatility: `max(0.4, 0.9 - day×0.03 - volatility×0.1)`

**Arming probability** is a weighted combination:
- 60%: how close the 7-day forecast is to the threshold
- 40%: how close the current value is to the threshold
- Averages across all conditions, capped at 0.99

### Synthetic Data

90 days of daily data generated for 5 admin units with NumPy (seed=42):

| Indicator | Source | Used For |
|---|---|---|
| `soil_moisture_pct` | Derived trend + noise | Drought triggers |
| `rainfall_mm_3h` | Derived trend + noise | Flood triggers |
| `rainfall_mm_24h` | 3h × uniform(2,5) | Supporting |
| `seasonal_forecast_probability_below_normal` | Derived trend + noise | Supporting |
| `ipc_phase` | Derived from soil moisture | Display |
| `river_level_m` | 2.5 + rainfall/20 | Flood triggers (Jonglei) |
| `ndvi` | 0.2 + soil_moisture/100 | Drought triggers (Gedaref) |

---

## Tech Stack

### Backend (Python)

| Layer | Technology | Role |
|---|---|---|
| Web framework | **FastAPI** | REST API with automatic OpenAPI docs |
| Data validation | **Pydantic v2** | Type-safe request/response schemas |
| Graph routing | **NetworkX** | Dijkstra shortest-path for mesh simulation |
| Synthetic data | **NumPy + Pandas** | Reproducible climate time-series (seed=42) |
| Server | **uvicorn** | ASGI server with hot-reload |

### Frontend (TypeScript/React)

| Layer | Technology | Role |
|---|---|---|
| Framework | **React 19 + TanStack Start** | Full-stack SSR with file-based routing |
| Routing | **TanStack Router** | Type-safe navigation |
| 3D viz | **Three.js + React** | Real-time WebGL Horn of Africa map |
| Styling | **Tailwind CSS v4** | Utility-first dark theme |
| Charts | **Recharts** | 14-day forecast visualisation |
| UI components | **Radix UI + shadcn** | Accessible composable primitives |
| Forms | **react-hook-form + Zod** | Trigger builder form validation |

### Data

- All state held **in-memory** (no database)
- Triggers loaded from `data/seed_triggers.json`
- Time-series auto-generated to `data/time_series.json`
- Mesh network configured in `mesh/simulator.py`

---

## Getting Started

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python3 model/generate_synthetic_data.py
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Or use the bundled script:

```bash
chmod +x run.sh
./run.sh
```

API docs available at `http://localhost:8000/docs`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Opens on `http://localhost:5173`. The backend runs on `http://localhost:8000`.

---

## API Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/triggers` | List all triggers (filterable by `country`, `hazard`, `status`) |
| POST | `/triggers` | Create a new trigger |
| GET | `/triggers/{id}` | Get a single trigger |
| GET | `/triggers/{id}/dispatch` | Get latest dispatch record for a trigger |
| POST | `/activate/{id}` | Activate a trigger (creates dispatch + mesh simulation) |
| POST | `/acknowledge/{dispatch_id}` | Institutional acknowledgment |
| POST | `/acknowledge-community/{dispatch_id}` | Community acknowledgment |
| GET | `/mesh/topology` | Mesh network graph (nodes + edges) |
| GET | `/mesh/status` | Node online/offline status |
| POST | `/mesh/simulate` | Run a delivery simulation |
| POST | `/mesh/offline` | Set specific nodes offline |
| POST | `/mesh/online` | Bring all nodes back online |
| GET | `/predict/{admin_unit}` | 14-day forecast for an admin unit |
| GET | `/institutions/scorecard` | Institution responsiveness scores |
| GET | `/timeline` | Recent event timeline |
| POST | `/triggers/refresh` | Force-refresh all trigger states |

---

## Pages

| Route | Page | Description |
|---|---|---|
| `/` | **God's View** | 3D situation room — the primary operational dashboard |
| `/triggers` | Trigger Registry | Browse and inspect all trigger protocols |
| `/trigger-builder` | Trigger Builder | Create new anticipatory action protocols |
| `/predictions` | Forecast Viewer | 14-day indicator forecasts per admin unit |
| `/regions` | Regional Overview | IGAD member states with trigger coverage |
| `/mesh` | Mesh Relay Network | Topology visualisation + delivery simulation |
| `/dispatches` | Dispatch Log | Hop-by-hop delivery records |
| `/activations` | Activation Timeline | End-to-end event replay |
| `/scorecard` | Institution Scorecard | Acknowledgment response times |
| `/institutions` | Institution Deep Dive | Per-organisation accountability |
| `/about` | About Kinga | Problem statement, architecture, team info |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (React 19)                  │
│  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌───────────────┐  │
│  │TanStack │ │  Three.js│ │Recharts│ │  Tailwind CSS  │  │
│  │ Router  │ │ 3D Map   │ │ Charts │ │  Dark Theme    │  │
│  └─────────┘ └──────────┘ └────────┘ └───────────────┘  │
│                        │ HTTP/JSON                      │
└────────────────────────┼────────────────────────────────┘
                         │
┌────────────────────────┼────────────────────────────────┐
│              FastAPI (Python)                           │
│  ┌──────────┐ ┌──────────────┐ ┌────────────────────┐   │
│  │  Routes  │ │  Store (in-  │ │  Mesh Simulator    │   │
│  │  /triggers│ │  memory)    │ │  (NetworkX Graph)  │   │
│  │  /activate│ │  triggers   │ │  Dijkstra routing  │   │
│  │  /mesh/*  │ │  dispatches │ │  14 nodes, 24 edges│   │
│  │  /predict │ │  timeline   │ │  Jitter simulation │   │
│  └──────────┘ │  acks       │ └────────────────────┘   │
│               └──────┬───────┘                         │
│              ┌───────┴───────┐                         │
│              │  Prediction   │                         │
│              │  Engine       │                         │
│              │  (statistical │                         │
│              │   trend ext.) │                         │
│              └───────────────┘                         │
└─────────────────────────────────────────────────────────┘
```

---

## Key Numbers for Judges

- **9 triggers** across **8 IGAD member states**
- **$845,000** total budget envelope at risk
- **14 mesh nodes**, **24 edges**, Dijkstra-routed
- **90 days** of synthetic data, **5 admin units**, **7 indicators**
- **6-stage timeline**: INGEST → ARMED → TRIGGER → MESH → INST ACK → COMM ACK
- **~1,050 lines** Python backend, **15,000+ lines** TypeScript/React frontend
- **9 institutions** tracked with response time scoring
- **100% offline-first**: frontend runs a complete client-side simulation when backend is unavailable

---

## The Pitch

> *"We built Kinga because early warnings mean nothing without early action. The Horn of Africa faces predictable climate shocks — drought in Marsabit, floods in Gedo — but the trigger-to-action pipeline is broken. Alerts sit in inboxes. Coordination is ad-hoc. No one tracks whether help actually arrived.*

> *Kinga closes that gap. We define the protocol, monitor conditions in real-time on a 3D map, anticipate when thresholds will breach with statistical forecasts, activate with one click — and the alert routes through a resilient mesh network to the field office. Every hop is logged. Every acknowledgment is tracked. Institutions are held accountable by a public scorecard.*

> *Even if cell towers fail, the mesh finds a path. Even if a community has only a basic phone, USSD works. This is anticipatory action — not after-action."*

---

## License

Built for the **IGAD Hackathon 2026**. Open source.
