# Data sources

The hackathon build runs entirely on synthetic data generated to match these schemas (see `backend/model/generate_synthetic_data.py`), so the demo works without live internet access during judging. This doc is the swap-in guide for connecting real feeds after the hackathon, or if venue internet allows it during the event.

## Live vs. periodic: read this before wiring anything up

Not every source below updates in the "streaming API" sense most people picture when they hear "live feed." Being precise about this matters — both for engineering effort and for what you tell judges.

| Indicator | Cadence | Wire up live for the demo? |
|---|---|---|
| Soil moisture (NASA POWER) | Near-real-time | Yes — easiest genuine live source, no API key |
| Rainfall, near-real-time (IMERG) | ~4 hour lag | Yes — best option if you want the demo to react to "yesterday's rain" |
| Rainfall, station-blended (CHIRPS) | ~45 day lag | No — good for historical model training, not for a live trigger |
| River discharge (GloFAS) | Daily forecast updates | Yes if time allows — purpose-built for triggering use cases |
| River gauge (national) | Varies, often not API-accessible | No — seed manually for the demo |
| NDVI (MODIS) | 16-day composite | No — historical/training use only |
| IPC food-insecurity phase | Released every few months | No — manually seeded, refresh periodically |
| Seasonal forecast probability (ICPAC) | Quarterly bulletins | No — manually seeded from published bulletins |

This unevenness is not a flaw to hide — it is itself evidence for the fragmentation problem documented in `PROBLEM_STATEMENT.md`. Kinga's job is to normalize whatever cadence each source actually has into one common trigger schema, not to fake a uniform live feed that doesn't exist in the real data landscape.

## Rainfall — CHIRPS (historical / model training)

- 35+ year quasi-global rainfall dataset at 0.05° resolution, produced by the Climate Hazards Center (UCSB), used for drought monitoring and trend analysis.
- **Access options:**
  - Google Earth Engine: `ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY')` — free for research/education/nonprofit use, requires Earth Engine registration.
  - Digital Earth Africa: free copy of CHIRPS monthly/daily products over Africa, accessible via the DE Africa Open Data Cube or the public AWS bucket (`s3://deafrica-input-datasets/rainfall_chirps_monthly/`, `af-south-1`, no-sign-request).
  - Note: CHIRPS v3 is now available and CHIRPS v2 production ends after December 2026 — new integrations should target v3.
  - **Caveat:** normally carries a ~45-day lag because it blends in station data. Use for training the LSTM on historical patterns, not for a live trigger feed.

## Rainfall — IMERG (near-real-time)

- NASA/JAXA satellite-only precipitation product, ~4-hour latency — the option to use if the demo needs to react to recent rainfall rather than last month's.
- Accessible via Earth Engine or NASA's GES DISC.

## River discharge — GloFAS

- Global Flood Awareness System, run by the EU's Copernicus program. Publishes river discharge forecasts globally, including the Horn of Africa, and is purpose-built for triggering/early-action use cases — a better fit than trying to source individual national gauge feeds.

## NDVI (vegetation health)

- Earth Engine: `MODIS/061/MOD13Q1` (250m, 16-day composite).
- Free with Earth Engine registration, same account as CHIRPS access above. 16-day cadence — historical/training use, not a live trigger input.

## River gauge data (national)

- Kenya: Water Resources Authority (WRA) HYDATA portal.
- Other member states: national hydrology/meteorology department equivalents — access and format vary by country, which is itself an instance of the fragmentation problem described in `PROBLEM_STATEMENT.md`. Prefer GloFAS above where coverage is adequate; fall back to seeded/manual data per national gauge for the demo.

## Soil moisture

- NASA POWER API (`power.larc.nasa.gov/api`) — free, no key required for basic queries. Near-real-time — the most straightforward genuinely live source to wire up.

## Seasonal forecasts / IPC phase

- ICPAC EarlyWarning4IGAD seasonal forecast bulletins (publicly published, e.g. June–September and July–September Greater Horn of Africa outlooks) — quarterly cadence, not an API; scrape or manually seed.
- IPC/CH classifications published per country by the IPC Global Partnership — released every few months, manually seeded and periodically refreshed.

## SMS / USSD delivery (real deployment)

- Africa's Talking provides a sandbox API for SMS, USSD, and voice across multiple African countries — suitable for prototyping the activation orchestrator's real-world delivery channel beyond the mesh simulation.
- For production, this would sit alongside (not replace) the mesh relay — mesh handles zero-connectivity relay; Africa's Talking-style gateways handle standard cellular delivery once a message reaches a connected node.

## Historical AA protocols (for grounding trigger definitions)

- WFP and the Start Network publish real Forecast-based Financing (FbF) / Anticipatory Action protocol documents with actual thresholds and pre-agreed actions — use one of these as the basis for the demo's seeded trigger data rather than inventing arbitrary numbers, so the pitch can point to a real precedent.

## Network access note for the hackathon environment

If your dev environment has restricted network egress (as this build environment does), Earth Engine, CHIRPS, and NASA POWER endpoints will not be reachable directly. The synthetic data generator produces schema-identical output so the model training, mesh simulation, and dashboard all run and demo correctly offline. Swap in `requests`/`earthengine-api` calls at the marked integration points in `backend/model/generate_synthetic_data.py` once you have venue internet access.