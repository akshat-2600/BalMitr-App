"""Rule-based growth trend analysis and WHO SD curve generation (not ML)."""
from ml import growth, who_loader

SEVERITY_RANK = {
    "Normal": 0,
    "Tall": 0,
    "Possible risk of overweight": 1,
    "Above normal weight-for-age": 1,
    "Overweight": 2,
    "Underweight": 2,
    "Stunted": 2,
    "Wasted": 2,
    "Thinness": 2,
    "Obesity": 3,
    "Severely underweight": 3,
    "Severely stunted": 3,
    "Severely wasted": 3,
    "Severe thinness": 3,
}


def analyze_trends(measurements: list[dict]) -> list[dict]:
    """Analyze chronological measurements (oldest -> newest) for plain-word trends.

    Each item expects: date (str), weight_kg (float), status, height_status, wfh_status, bmi_status.
    """
    if len(measurements) < 2:
        return []

    findings: list[dict] = []
    prev = measurements[-2]
    curr = measurements[-1]

    w_prev = float(prev["weight_kg"])
    w_curr = float(curr["weight_kg"])
    if w_curr < w_prev:
        diff = round(w_prev - w_curr, 2)
        findings.append({
            "code": "TREND_WEIGHT_DROP",
            "severity": "warning",
            "message": f"Weight dropped by {diff} kg since the previous visit ({prev['date']}).",
        })
    elif len(measurements) >= 3:
        w_prev2 = float(measurements[-3]["weight_kg"])
        if w_curr <= w_prev and w_prev <= w_prev2:
            findings.append({
                "code": "TREND_NO_GAIN_TWO_VISITS",
                "severity": "warning",
                "message": "No weight gain recorded across the last two visits.",
            })

    indicators = [
        ("Weight-for-age", "status"),
        ("Height-for-age", "height_status"),
        ("Weight-for-height", "wfh_status"),
        ("BMI-for-age", "bmi_status"),
    ]
    for label, key in indicators:
        old_s = prev.get(key) or ""
        new_s = curr.get(key) or ""
        if not old_s or not new_s or "Not applicable" in old_s or "Not applicable" in new_s:
            continue
        old_r = SEVERITY_RANK.get(old_s, 0)
        new_r = SEVERITY_RANK.get(new_s, 0)
        if new_r > old_r:
            findings.append({
                "code": "TREND_CROSSED_WORSE",
                "severity": "warning",
                "message": f"{label} crossed a WHO cut-off ({old_s} -> {new_s}).",
            })
        elif new_r < old_r:
            findings.append({
                "code": "TREND_CROSSED_BETTER",
                "severity": "ok",
                "message": f"{label} improved across a WHO cut-off ({old_s} -> {new_s}).",
            })

    if not findings and w_curr > w_prev:
        findings.append({
            "code": "TREND_STEADY_GAIN",
            "severity": "ok",
            "message": f"Gained {round(w_curr - w_prev, 2)} kg since the previous visit ({prev['date']}).",
        })

    return findings


def _sd_row(x_val: float, lms: tuple[float, float, float]) -> dict:
    L, M, S = lms
    return {
        "x": x_val,
        "sd3neg": round(growth.value_from_z(-3, L, M, S), 2),
        "sd2neg": round(growth.value_from_z(-2, L, M, S), 2),
        "median": round(M, 2),
        "sd2": round(growth.value_from_z(2, L, M, S), 2),
        "sd3": round(growth.value_from_z(3, L, M, S), 2),
    }


def build_growth_curves(sex: str, age_months: int) -> dict:
    """Build WHO SD reference curves (-3, -2, median, +2, +3) for the child's age group."""
    if age_months <= 60:
        wfa_curve = [_sd_row(m, who_loader.get_wfa_lms(sex, m)) for m in range(0, 61)]
        hfa_curve = [_sd_row(m, who_loader.get_hfa_lms(sex, m)) for m in range(0, 61)]
        wfh_table = who_loader.get_wfh_table(sex, age_months)
        wfh_curve = [
            _sd_row(h, wfh_table[h])
            for h in sorted(wfh_table.keys())
            if abs(h - round(h)) < 1e-6 or round(h * 2) == h * 2  # 0.5 cm steps keep chart smooth & light
        ]
        return {
            "age_group": "0-60 months (WHO Child Growth Standards)",
            "wfa": {"label": "Weight-for-age (kg)", "x_label": "Age (months)", "applicable": True, "curves": wfa_curve},
            "hfa": {"label": "Length/Height-for-age (cm)", "x_label": "Age (months)", "applicable": True, "curves": hfa_curve},
            "wfh": {
                "label": "Weight-for-length/height (kg)",
                "x_label": "Length / Height (cm)",
                "applicable": True,
                "curves": wfh_curve,
            },
            "bmi": {"label": "BMI-for-age", "applicable": False, "reason": "Applies from 61 to 144 months."},
        }

    hfa_curve = [_sd_row(m, who_loader.get_hfa_lms(sex, m)) for m in range(61, 145)]
    bmi_curve = [_sd_row(m, who_loader.get_bmi_lms(sex, m)) for m in range(61, 145)]
    wfa_applicable = age_months <= 120
    wfa_curve = (
        [_sd_row(m, who_loader.get_wfa_lms(sex, m)) for m in range(61, 121)]
        if wfa_applicable
        else []
    )
    return {
        "age_group": "61-144 months (WHO 2007 Growth Reference)",
        "hfa": {"label": "Height-for-age (cm)", "x_label": "Age (months)", "applicable": True, "curves": hfa_curve},
        "bmi": {"label": "BMI-for-age (kg/m²)", "x_label": "Age (months)", "applicable": True, "curves": bmi_curve},
        "wfa": {
            "label": "Weight-for-age (kg)",
            "x_label": "Age (months)",
            "applicable": wfa_applicable,
            "reason": "" if wfa_applicable else "WHO weight-for-age applies only up to 120 months.",
            "curves": wfa_curve,
        },
        "wfh": {"label": "Weight-for-height", "applicable": False, "reason": "Not applicable for this age"},
    }
