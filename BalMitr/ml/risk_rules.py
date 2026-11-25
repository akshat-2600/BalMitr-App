"""Rule-based risk level calculator (Proposed: needs expert review).

Not machine learning. Each reason carries a rule_id matching docs/risk_rules.md.
"""

RISK_NOTICE = "Proposed: needs expert review"


def assess_risk(latest: dict | None, trends: list[dict] | None = None) -> dict:
    """Compute Low / Moderate / High risk with rule IDs from latest measurement & trends."""
    if not latest:
        return {
            "level": "Low",
            "reasons": [{"rule_id": "RISK_NO_MEASUREMENT", "text": "No measurement recorded yet."}],
            "notice": RISK_NOTICE,
        }

    trends = trends or []
    trend_codes = {t.get("code") for t in trends}
    reasons: list[dict[str, str]] = []
    high = False
    mod_count = 0

    wfa_s = (latest.get("status") or "").lower()
    hfa_s = (latest.get("height_status") or "").lower()
    wfh_s = (latest.get("wfh_status") or "").lower()
    bmi_s = (latest.get("bmi_status") or "").lower()

    # Severe indicators -> High
    if wfa_s == "severely underweight":
        high = True
        reasons.append({"rule_id": "RISK_SEV_WFA", "text": "Weight-for-age is below -3 SD (Severely underweight)."})
    elif wfa_s == "underweight":
        mod_count += 1
        reasons.append({"rule_id": "RISK_MOD_WFA", "text": "Weight-for-age is between -3 and -2 SD (Underweight)."})

    if hfa_s == "severely stunted":
        high = True
        reasons.append({"rule_id": "RISK_SEV_HFA", "text": "Height-for-age is below -3 SD (Severely stunted)."})
    elif hfa_s == "stunted":
        mod_count += 1
        reasons.append({"rule_id": "RISK_MOD_HFA", "text": "Height-for-age is between -3 and -2 SD (Stunted)."})

    if wfh_s == "severely wasted":
        high = True
        reasons.append({"rule_id": "RISK_SEV_WFH", "text": "Weight-for-height is below -3 SD (Severely wasted)."})
    elif wfh_s == "wasted":
        mod_count += 1
        reasons.append({"rule_id": "RISK_MOD_WFH", "text": "Weight-for-height is between -3 and -2 SD (Wasted)."})

    if bmi_s == "severe thinness":
        high = True
        reasons.append({"rule_id": "RISK_SEV_BMI", "text": "BMI-for-age is below -3 SD (Severe thinness)."})
    elif bmi_s == "thinness":
        mod_count += 1
        reasons.append({"rule_id": "RISK_MOD_BMI_THIN", "text": "BMI-for-age is between -3 and -2 SD (Thinness)."})

    if bmi_s == "obesity" or wfh_s == "obese":
        high = True
        reasons.append({"rule_id": "RISK_OBESITY", "text": "Weight/BMI-for-age is in the WHO Obesity range."})
    elif bmi_s == "overweight" or wfh_s in ("overweight", "possible risk of overweight"):
        reasons.append({"rule_id": "RISK_OVERWEIGHT", "text": "Weight/BMI-for-age is above +1 SD (Overweight risk)."})

    # Trend checks
    has_faltering = False
    if "TREND_WEIGHT_DROP" in trend_codes:
        has_faltering = True
        reasons.append({"rule_id": "RISK_WEIGHT_DROP", "text": "Weight dropped since the previous visit."})
    elif "TREND_NO_GAIN_TWO_VISITS" in trend_codes:
        has_faltering = True
        reasons.append({"rule_id": "RISK_NO_GAIN", "text": "No weight gain recorded across two visits."})

    if mod_count >= 2 and has_faltering:
        high = True
        reasons.append({
            "rule_id": "RISK_MULTI_MOD_DROP",
            "text": "Multiple moderate deficits combined with weight drop or stagnation.",
        })

    if latest.get("is_flagged"):
        reasons.append({
            "rule_id": "RISK_FLAGGED",
            "text": "Measurement triggered a WHO plausibility flag — re-check height and weight.",
        })

    if high:
        level = "High"
    elif reasons:
        level = "Moderate"
    else:
        level = "Low"
        reasons.append({"rule_id": "RISK_NORMAL", "text": "All applicable WHO indicators are within normal cut-offs."})

    return {"level": level, "reasons": reasons, "notice": RISK_NOTICE}
