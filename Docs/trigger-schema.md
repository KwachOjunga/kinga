# Trigger schema

This is the core data model Kinga contributes: a standardized way to encode an Anticipatory Action (AA) protocol so it can be evaluated by software instead of read from a PDF. It is designed to work across hazards and across the 8 IGAD member states without modification.

## Schema

```json
{
  "trigger_id": "KE-MSB-DROUGHT-01",
  "country": "Kenya",
  "admin_unit": "Marsabit County",
  "hazard": "drought",
  "conditions": [
    {
      "indicator": "seasonal_forecast_probability_below_normal",
      "operator": ">=",
      "threshold": 0.60,
      "unit": "probability"
    },
    {
      "indicator": "ipc_phase",
      "operator": ">=",
      "threshold": 3,
      "unit": "phase"
    }
  ],
  "condition_logic": "AND",
  "action": {
    "action_id": "cash_transfer_protocol_A",
    "description": "Unconditional cash transfer, pre-positioned funding envelope",
    "budget_envelope_usd": 250000
  },
  "responsible_institution": {
    "name": "Kenya NDMA, Marsabit sub-office",
    "contact_channel": "mesh_sms",
    "escalation_contact": "Kenya NDMA, national office"
  },
  "acknowledgment_deadline_hours": 6,
  "status": "dormant"
}
```

## Field notes

- **`conditions`** is a list so a trigger can require multiple indicators (e.g. a forecast probability AND a food-insecurity phase) before firing. `condition_logic` currently supports `AND`; `OR` and weighted/partial logic are a natural extension.
- **`status`** is one of `dormant`, `arming`, `triggered`, `activated`, `confirmed` — this is exactly what drives the dashboard's trigger status map coloring.
  - `dormant` — no condition close to threshold
  - `arming` — the LSTM anticipation model forecasts the threshold will likely be crossed within 7–14 days
  - `triggered` — the hard rule has fired (all conditions met)
  - `activated` — the action checklist has been dispatched to the responsible institution
  - `confirmed` — the institution has acknowledged and logged the action as taken
- **`acknowledgment_deadline_hours`** is what the response-tracking model measures against. Time-to-ack and time-to-action are both logged relative to this.
- **`escalation_contact`** is used by the anomaly-detection model: if an institution is flagged as trending toward a missed deadline, the orchestrator can auto-notify this contact before the deadline passes rather than after.

## Why this schema, specifically

This directly encodes the structure IGAD's own AA mapping exercise is currently reconstructing by hand: hazard, geography, indicator/threshold, pre-agreed action, and responsible institution, across 8 countries and multiple years of activation history. A working instance of this schema, populated and continuously updated, **is** the deliverable that exercise is trying to produce manually.

## Hazard portability

The same schema handles a flood trigger with no structural change:

```json
{
  "trigger_id": "SO-JUB-FLOOD-01",
  "country": "Somalia",
  "admin_unit": "Jubaland, Dolow district",
  "hazard": "flood",
  "conditions": [
    { "indicator": "river_level_m", "operator": ">", "threshold": 4.2, "unit": "m" }
  ],
  "condition_logic": "AND",
  "action": { "action_id": "evacuation_and_shelter_protocol_B", "description": "Pre-positioned shelter activation", "budget_envelope_usd": 90000 },
  "responsible_institution": { "name": "Somalia DRM, Dolow office", "contact_channel": "mesh_sms", "escalation_contact": "Somalia DRM, regional office" },
  "acknowledgment_deadline_hours": 3,
  "status": "dormant"
}
```