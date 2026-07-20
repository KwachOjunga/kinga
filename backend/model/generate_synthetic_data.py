from __future__ import annotations

import json
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import pandas as pd

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
OUTPUT_PATH = DATA_DIR / "time_series.json"

ADMIN_UNITS = [
    "Marsabit County",
    "Gedo",
    "Somali Region",
    "Turkana County",
    "Karamoja",
]

INDICATORS = [
    "soil_moisture_pct",
    "rainfall_mm_3h",
    "rainfall_mm_24h",
    "seasonal_forecast_probability_below_normal",
    "ipc_phase",
    "river_level_m",
    "ndvi",
]


def generate_synthetic_data(days: int = 90, seed: int = 42) -> dict:
    rng = np.random.default_rng(seed)
    random.seed(seed)
    now = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    dates = [now - timedelta(days=i) for i in range(days - 1, -1, -1)]

    series: dict[str, list[dict]] = {}
    for unit in ADMIN_UNITS:
        unit_series: list[dict] = []
        soil = float(rng.uniform(20, 35))
        rain_3h = float(rng.uniform(5, 20))
        forecast_prob = float(rng.uniform(0.3, 0.5))

        for day_idx, dt in enumerate(dates):
            if unit in ("Marsabit County", "Turkana County", "Somali Region"):
                soil -= rng.uniform(0.05, 0.25)
                soil = max(8, soil)
                rain_3h = max(0, rain_3h + rng.normal(0, 1.5))
                forecast_prob = min(0.95, forecast_prob + rng.uniform(0, 0.02))
            else:
                rain_3h = max(0, rain_3h + rng.normal(0, 3))
                soil = min(80, soil + rng.uniform(-1, 2))

            unit_series.append(
                {
                    "date": dt.isoformat(),
                    "soil_moisture_pct": round(soil, 2),
                    "rainfall_mm_3h": round(rain_3h, 2),
                    "rainfall_mm_24h": round(rain_3h * rng.uniform(2, 5), 2),
                    "seasonal_forecast_probability_below_normal": round(
                        forecast_prob, 3
                    ),
                    "ipc_phase": int(min(5, max(1, round(2 + (18 - soil) / 10)))),
                    "river_level_m": round(2.5 + rain_3h / 20, 2),
                    "ndvi": round(0.2 + soil / 100, 3),
                }
            )
        series[unit] = unit_series

    return series


def save_time_series(path: Path | None = None) -> Path:
    path = path or OUTPUT_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    data = generate_synthetic_data()
    with path.open("w") as f:
        json.dump(data, f, indent=2)
    return path


def load_time_series(path: Path | None = None) -> dict:
    path = path or OUTPUT_PATH
    if not path.exists():
        save_time_series(path)
    with path.open() as f:
        return json.load(f)


def latest_indicators(admin_unit: str) -> dict[str, float]:
    series = load_time_series()
    rows = series.get(admin_unit, [])
    if not rows:
        return {}
    return {k: v for k, v in rows[-1].items() if k != "date"}


def indicator_history(admin_unit: str, indicator: str, days: int = 30) -> list[float]:
    series = load_time_series()
    rows = series.get(admin_unit, [])[-days:]
    return [row[indicator] for row in rows if indicator in row]


if __name__ == "__main__":
    out = save_time_series()
    print(f"Wrote synthetic time series to {out}")
