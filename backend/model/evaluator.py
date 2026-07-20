from __future__ import annotations

from .generate_synthetic_data import indicator_history, latest_indicators

OPERATORS = {
    ">=": lambda a, b: a >= b,
    ">": lambda a, b: a > b,
    "<=": lambda a, b: a <= b,
    "<": lambda a, b: a < b,
    "==": lambda a, b: a == b,
}


def evaluate_condition(
    indicator: str, operator: str, threshold: float, admin_unit: str
) -> tuple[bool, float]:
    values = latest_indicators(admin_unit)
    current = values.get(indicator)
    if current is None:
        return False, 0.0
    op_fn = OPERATORS.get(operator)
    if op_fn is None:
        return False, current
    return op_fn(current, threshold), current


def evaluate_trigger(trigger: dict) -> tuple[bool, list[dict]]:
    admin_unit = trigger["admin_unit"]
    logic = trigger.get("condition_logic", "AND")
    results: list[dict] = []
    met_flags: list[bool] = []

    for cond in trigger["conditions"]:
        met, current = evaluate_condition(
            cond["indicator"], cond["operator"], cond["threshold"], admin_unit
        )
        met_flags.append(met)
        results.append(
            {
                **cond,
                "current_value": current,
                "met": met,
            }
        )

    if logic == "OR":
        fired = any(met_flags)
    else:
        fired = all(met_flags) if met_flags else False

    return fired, results


def update_trigger_conditions(trigger: dict) -> dict:
    _, results = evaluate_trigger(trigger)
    trigger = {**trigger}
    trigger["conditions"] = [
        {k: v for k, v in r.items() if k != "met"} for r in results
    ]
    return trigger
