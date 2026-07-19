# Problem statement

## The bottleneck is not prediction

Hazard prediction for the Horn of Africa is a mature, well-funded space. Google's Flood Hub uses AI trained on satellite and hydrological data to forecast riverine floods and had scaled to over 460 million people globally by 2023, including parts of Africa. ICPAC itself moved its infrastructure to Google Cloud in 2025–2026, cutting the time to process geospatial data and issue early warnings from eight hours to thirty minutes.

The warnings are getting faster and more accurate. The outcomes are not improving at the same rate.

## Evidence: warnings arrive, action doesn't follow

ICPAC's own technical reporting on regional flood impact states plainly:

> "The extent of the impacts of these floods shows the gaps in preparedness and early action **despite early warning information being availed on time.**"

This is the specific, admitted, documented gap Kinga targets — not a hypothetical problem invented for a hackathon brief.

## Evidence: the coordination layer is fragmented

A 2025 review of early warning system financing and implementation describes the state of the field across the Global South:

- Data from multiple sources is often "inconsistent, incomplete, or not shared effectively across systems," with **no standardization in early warning protocols and data formats between agencies and countries**, including differing trigger criteria for what counts as a warning.
- This fragmentation "hinders the creation of a common operating picture of risk."
- Connecting all relevant actors — from international agencies down to community groups — and adapting response plans to real, local conditions remains a persistent hurdle.

## Evidence: Anticipatory Action protocol tracking is currently a manual, human process

As of mid-2025, IGAD is actively commissioning a consultant to conduct a "Regional Mapping and Baseline Survey of Anticipatory Action Initiatives in Eastern Africa," tasked with mapping existing AA capacity, gaps, tools, protocols, and the **number of AA activations across Burundi, Ethiopia, Kenya, Rwanda, Somalia, South Sudan, Sudan, and Uganda from 2020–2025.**

This confirms, directly from IGAD's own procurement documents, that there is currently **no digital system doing this tracking**. It is being reconstructed by hand, after the fact, by a paid consultant. Kinga is that system, built to run continuously and automatically, going forward.

## What this means for scope

Kinga deliberately does **not** try to out-predict Google Flood Hub or ICPAC's own forecasting stack. It consumes hazard forecasts as one input signal among several, and focuses its own engineering effort on the layer that is documented as broken:

| Layer | Status in the region | Kinga's role |
|---|---|---|
| Hazard prediction | Mature (Google Flood Hub, ICPAC/Google Cloud) | Consumed as an input signal |
| Trigger definition & standardization | Fragmented, inconsistent across agencies | Kinga defines a common schema (see `TRIGGER_SCHEMA.md`) |
| Activation tracking | Manual, consultant-driven, retrospective | Kinga automates and logs it in real time |
| Institutional accountability | Not systematically tracked anywhere found | Kinga's responsiveness scorecard |
| Last-mile delivery under degraded connectivity | Typically assumes cellular network is up | Kinga's mesh relay explicitly handles the case where it isn't |

## Sources

- ICPAC, *Technical Report on the Ongoing Flood Impact in the IGAD Region*
- Google, *How we are using AI for reliable flood forecasting at a global scale*; *Early warning systems for floods based on AI* (Flood Hub reach figures)
- Meteorological Technology International, *ICPAC delivers early warnings 90% faster thanks to data center improvements*
- *AI for Climate Finance: Agentic Retrieval and Multi-Step Reasoning for Early Warning System Investments* (arXiv, 2025) — data fragmentation and interoperability findings
- IGAD, *Terms of Reference: Consulting Services to Support ICPAC in Undertaking a Regional Mapping and Baseline Survey of Anticipatory Action Initiatives in Eastern Africa* (2025)