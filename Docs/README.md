# Kinga

**An anticipatory action trigger & activation engine for the IGAD region.**

Kinga closes the gap between an early warning being issued and a pre-agreed action actually happening. It digitizes Anticipatory Action (AA) protocols — pre-agreed thresholds that automatically activate funded responses — monitors live hazard data against them, dispatches action checklists through a resilient mesh/SMS relay, and tracks whether the responsible institution actually acknowledged and acted in time.

Built for the IGAD Hackathon 2026.

## The problem, in one line

ICPAC's own technical reporting states that recent floods showed "gaps in preparedness and early action despite early warning information being availed on time." Prediction is not the bottleneck. **Wiring warnings to action is.** See [`docs/PROBLEM_STATEMENT.md`](docs/PROBLEM_STATEMENT.md) for the full evidence base.

## What Kinga does

1. **Define** — encode an Anticipatory Action protocol as structured data instead of a PDF (hazard, admin unit, indicator, threshold, responsible institution, pre-agreed action).
2. **Monitor** — continuously evaluate live/synthetic hazard feeds against every defined trigger.
3. **Anticipate** — an LSTM forecasts whether a threshold is likely to be crossed in the next 7–14 days, giving extra lead time before the hard trigger fires.
4. **Activate** — when a trigger fires, dispatch the pre-agreed action checklist to the responsible institution via a mesh network relay that keeps working even if the cellular network is down.
5. **Track** — log every dispatch, delivery hop, and acknowledgment. A second model flags institutions trending toward a delayed response before they're late.
6. **Show** — a "God's view" Situation Room dashboard displays trigger state per admin unit, threshold gauges, an activation timeline replay, and an institutional responsiveness scorecard.

## Repository structure

```
kinga/
├── README.md
├── docs/
│   ├── ARCHITECTURE.md        system design, components, data flow
│   ├── PROBLEM_STATEMENT.md   evidence base and gap analysis
│   ├── TRIGGER_SCHEMA.md      the AA protocol data schema
│   ├── API_SPEC.md            backend endpoint reference
│   ├── DATA_SOURCES.md        real data integration guide
│   └── ROADMAP.md             12-day build plan
├── backend/
│   ├── main.py                 FastAPI app
│   ├── requirements.txt
│   ├── model/                  synthetic data + LSTM anticipation model
│   └── mesh/                   mesh network relay simulator
└── frontend/
    └── dashboard.html           Situation Room dashboard
```

## Quick start

```bash
cd backend
pip install -r requirements.txt --break-system-packages
python model/generate_synthetic_data.py     # builds sample hazard time series
python model/train_model.py                 # trains the anticipation LSTM
uvicorn main:app --reload                    # starts the API on :8000
```

Open `frontend/dashboard.html` in a browser, or serve it statically — it talks to the API at `http://localhost:8000`.

## Hackathon pitch, one sentence

> IGAD is currently paying a consultant to manually reconstruct anticipatory-action trigger and activation data across 8 member states, 2020–2025. Kinga is the system that generates that data automatically, going forward — and tells you which institution in the chain is the bottleneck before it costs lives.
