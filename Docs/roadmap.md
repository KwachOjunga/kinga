# 12-day roadmap

## Days 1–2 — Ground the demo in a real protocol
- Select 2–3 real AA protocol examples (WFP/Start Network FbF documents) to base seeded trigger data on — see `DATA_SOURCES.md`.
- Finalize the trigger schema against these real examples (`TRIGGER_SCHEMA.md`).
- Repo setup, environments, dependency install.

## Days 3–5 — Trigger engine + anticipation model
- Build the rules evaluator (deterministic condition matching against the schema).
- Generate synthetic time-series data (`generate_synthetic_data.py`).
- Train the LSTM anticipation model; validate its "arming" forecasts against known synthetic threshold-crossing events.
- Wrap both in the FastAPI `/triggers` and `/predict` endpoints.

## Days 6–8 — Activation + mesh + response tracking
- Build the activation orchestrator (`/activate`, `/acknowledge`).
- Build the mesh relay simulator (NetworkX graph, hop latency, node dropout, automatic rerouting).
- Seed realistic institutional response-time data; build the anomaly/lateness flag (start with a simple statistical baseline — z-score against an institution's historical average — before reaching for a heavier model if time allows).

## Days 9–10 — Situation Room dashboard
- Trigger status map (5-state coloring).
- Threshold gauges for a selected admin unit.
- Activation timeline replay.
- Institutional responsiveness scorecard.
- Wire the dashboard to the live FastAPI backend (fall back to static demo JSON if backend calls fail mid-demo — always have an offline fallback for hackathon wifi).

## Day 11 — Integration and polish
- End-to-end run-through: trigger arms → fires → activates → dispatches via mesh → institution acknowledges → scorecard updates.
- Multilingual notification text (Swahili/Somali/Amharic) for the activation checklist messages.
- Stress-test the demo path at least 5 times.

## Day 12 — Pitch prep
- Record a backup demo video (hackathon wifi always fails at the worst moment).
- Build the slide deck: problem (cite `PROBLEM_STATEMENT.md` directly) → gap → Kinga's specific answer → live demo → what's next.
- Rehearse the one-sentence pitch from `README.md` as the opening line.

## Explicit non-goals for the 12 days

- Live production integration with CHIRPS/IPC/ICPAC feeds (documented swap-in point only — see `DATA_SOURCES.md`)
- Physical LoRa hardware (stretch goal only, software simulation is the primary deliverable)
- Multi-tenant auth for real institutional users
- A live telecom SMS/USSD gateway (mocked for the demo)