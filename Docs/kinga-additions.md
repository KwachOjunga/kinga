# Doc additions — last mile, trust, GIS, feedback loop

Drop-in additions for `architecture.md`, `trigger-schema.md`, and `roadmap.md`, addressing the four thin spots against the "From Warning to Action" brief.

---

## 1. `architecture.md` — new layer 4c: Community broadcast tier

Insert after section 2.4a (Mesh relay network):

```
### 2.4c Community broadcast tier

Institutional acknowledgment (4b) is not the end of the chain — the brief specifically
names communities, including remote and vulnerable ones, as recipients who need to
understand, trust, and act. Once the responsible institution acknowledges a dispatch,
the orchestrator fans out a second, simpler message over the same mesh relay to a
registered community contact list for that admin unit (community health workers,
chiefs, local radio contacts — whoever the pre-agreed protocol names).

This message is intentionally shorter and non-technical: what's expected, what to do,
in the local language. It reuses the multilingual notification text already planned
for Day 11 of the roadmap, just extends the recipient list beyond the institution.
```

Update the layer diagram's box 4a/4b row to note the fan-out:

```
┌───────────────────────────────┐   ┌─────────────────────────────┐
│ 4a. MESH RELAY NETWORK          │   │ 4b. RESPONSE TRACKING       │
│     Hop-to-hop delivery to      │   │     Logs dispatch/ack        │
│     institutions AND community  │   │     timestamps; anomaly      │
│     contacts (4c)               │   │     model flags slow actors  │
└───────────────┬─────────────────┘   └───────────────┬─────────────┘
```

## 2. `architecture.md` — GIS layering under the trigger status map

Add to section 2.5 (Situation Room dashboard), under "Trigger status map":

```
The trigger status map is not just a colored-by-state overlay — it layers one real
geospatial dataset underneath the trigger markers (population density or IPC phase
boundaries, sourced per DATA_SOURCES.md), so the map answers "how many people are
exposed here" alongside "what state is this trigger in." This is the concrete GIS
component of the stack, not just a status indicator styled as a map.
```

## 3. `trigger-schema.md` — rationale field and community broadcast block

Add a `rationale` field next to the LSTM arming forecast, and a `community_broadcast`
block alongside `responsible_institution`:

```json
{
  "trigger_id": "KE-MSB-DROUGHT-01",
  "...": "...",
  "conditions": [
    {
      "indicator": "seasonal_forecast_probability_below_normal",
      "operator": ">=",
      "threshold": 0.60,
      "unit": "probability",
      "rationale": "3 of the last 4 weeks were below-normal rainfall"
    }
  ],
  "responsible_institution": {
    "name": "Kenya NDMA, Marsabit sub-office",
    "contact_channel": "mesh_sms",
    "escalation_contact": "Kenya NDMA, national office"
  },
  "community_broadcast": {
    "enabled": true,
    "contact_list_id": "MSB-community-contacts-01",
    "language": ["Swahili", "Somali"],
    "message_template": "short_non_technical",
    "feedback_channel": "ussd_ack"
  }
}
```

Add a field note:

```
- **`conditions[].rationale`** — a one-line, plain-language reason the condition is
  close to firing (e.g. recent rainfall pattern), included in the dispatched message
  alongside the raw probability. This is what builds first-time trust with a
  recipient who has no reason yet to trust a bare confidence score.
- **`community_broadcast`** — defines whether and how a second-tier message reaches
  registered community contacts once the responsible institution acknowledges.
  `feedback_channel` names how the community can confirm receipt/action back
  (see the feedback loop addition below).
```

## 4. `trigger-schema.md` / `Api-specs.md` — community feedback loop

New endpoint, alongside `POST /acknowledge/{dispatch_id}`:

```
### `POST /acknowledge-community/{dispatch_id}`
Lightweight USSD-style confirmation from a community contact — "received" and,
optionally, "action taken" — closing the loop the institutional `/acknowledge`
endpoint doesn't reach. Same dispatch_id, separate acknowledgment record, so the
scorecard can eventually distinguish institutional response time from community-level
uptake without conflating the two.

**Body**
{ "acknowledged_by": "community contact / USSD short code", "received": true, "action_taken": null }
```

## 5. `roadmap.md` — explicit tasks

Add to Days 6–8:

```
- Add community_broadcast fan-out to the activation orchestrator (after institutional ack)
- Add rationale field to trigger conditions and surface it in the dispatched message
```

Add to Days 9–10:

```
- Layer one real GIS dataset (population density or IPC phase) under the trigger status map
```

Add to Day 11:

```
- Wire the community-side USSD/SMS acknowledgment endpoint as a stub (can be mocked
  for the demo, same as the Africa's Talking sandbox path)
```