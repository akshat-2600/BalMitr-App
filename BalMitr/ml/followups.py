"""Rule-based follow-up & referral progress calculation (not ML)."""


def calculate_progress(baseline_z: dict, latest_z: dict, threshold: float = 0.25) -> dict:
    """Compare latest Z-scores with baseline Z-scores at the first follow-up/referral.

    Returns {"status": "improved" | "same" | "worse" | "not_enough_data", "deltas": {...}, "summary": "..."}.
    """
    deltas = {}
    for key in ("wfa", "hfa", "wfh", "bmi"):
        b = baseline_z.get(key)
        l = latest_z.get(key)
        if b is not None and l is not None:
            deltas[key] = round(float(l) - float(b), 2)

    if not deltas:
        return {
            "status": "not_enough_data",
            "deltas": {},
            "summary": "Need baseline and latest Z-scores to calculate progress.",
        }

    vals = list(deltas.values())
    has_worse = any(v <= -threshold for v in vals)
    has_improved = any(v >= threshold for v in vals)

    if has_worse and not has_improved:
        status = "worse"
    elif has_improved and not has_worse:
        status = "improved"
    elif has_worse and has_improved:
        avg = sum(vals) / len(vals)
        status = "improved" if avg >= threshold else ("worse" if avg <= -threshold else "same")
    else:
        status = "same"

    parts = [f"{k.upper()} {'+' if v > 0 else ''}{v}" for k, v in deltas.items()]
    label = status.capitalize()
    return {
        "status": status,
        "deltas": deltas,
        "summary": f"{label} since first follow-up/referral ({', '.join(parts)}).",
    }
