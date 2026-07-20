from __future__ import annotations

from .evaluator import evaluate_condition
from .generate_synthetic_data import indicator_history, latest_indicators

ARMING_THRESHOLD = 0.5
FORECAST_DAYS = 14


def forecast_indicator(
    admin_unit: str, indicator: str, days: int = FORECAST_DAYS
) -> list[dict]:
    history = indicator_history(admin_unit, indicator, days=30)
    if len(history) < 3:
        current = latest_indicators(admin_unit).get(indicator, 0.0)
        return [
            {
                "day": d,
                "indicator": indicator,
                "predicted_value": float(current),
                "confidence": 0.5,
            }
            for d in range(1, days + 1)
        ]

    recent = history[-7:]
    trend = (recent[-1] - recent[0]) / max(len(recent) - 1, 1)
    current = recent[-1]
    volatility = max(0.01, (max(recent) - min(recent)) / max(abs(current), 1))

    forecast: list[dict] = []
    for day in range(1, days + 1):
        predicted = current + trend * day
        confidence = max(0.4, 0.9 - day * 0.03 - volatility * 0.1)
        forecast.append(
            {
                "day": day,
                "indicator": indicator,
                "predicted_value": round(float(predicted), 4),
                "confidence": round(confidence, 2),
            }
        )
    return forecast


def arming_probability(trigger: dict) -> float:
    admin_unit = trigger["admin_unit"]
    probs: list[float] = []

    for cond in trigger["conditions"]:
        indicator = cond["indicator"]
        threshold = cond["threshold"]
        operator = cond["operator"]
        forecast = forecast_indicator(admin_unit, indicator, days=7)
        day7 = forecast[-1]["predicted_value"] if forecast else 0.0

        if operator in (">=", ">"):
            distance = threshold - day7
            span = max(abs(threshold), 1.0)
            prob = 1.0 - min(1.0, max(0.0, distance / span))
        elif operator in ("<=", "<"):
            distance = day7 - threshold
            span = max(abs(threshold), 1.0)
            prob = 1.0 - min(1.0, max(0.0, distance / span))
        else:
            prob = 0.1

        _, current = evaluate_condition(
            indicator, operator, threshold, admin_unit
        )
        current_proximity = 0.0
        if operator in (">=", ">"):
            current_proximity = min(1.0, current / max(threshold, 0.01))
        elif operator in ("<=", "<"):
            current_proximity = min(1.0, threshold / max(current, 0.01))

        probs.append(0.6 * prob + 0.4 * current_proximity)

    if not probs:
        return 0.0
    return round(min(0.99, sum(probs) / len(probs)), 2)


def forecast_for_admin_unit(admin_unit: str, indicators: list[str]) -> list[dict]:
    forecast: list[dict] = []
    for indicator in indicators:
        for point in forecast_indicator(admin_unit, indicator):
            if point["day"] in (1, 7, 14):
                forecast.append(point)
    return forecast
