from ml import followups, risk_rules, trends
from .models import Child, Measurement, RiskAssessment


def baseline_z_from_latest(child: Child) -> dict:
    m = child.measurements.first()
    if not m:
        return {"wfa": None, "hfa": None, "wfh": None, "bmi": None}
    return {
        "wfa": m.weight_for_age_z,
        "hfa": m.height_for_age_z,
        "wfh": m.weight_for_height_z,
        "bmi": m.bmi_for_age_z,
    }


def compute_child_progress(child: Child) -> dict | None:
    """Compare child's latest Z-scores with baseline at their first follow-up or referral."""
    latest = child.measurements.first()
    if not latest:
        return None
    candidates = []
    fu = child.follow_ups.order_by("created_at", "id").first()
    if fu and any(v is not None for v in (fu.baseline_wfa_z, fu.baseline_hfa_z, fu.baseline_wfh_z, fu.baseline_bmi_z)):
        candidates.append((fu.created_at, {
            "wfa": fu.baseline_wfa_z,
            "hfa": fu.baseline_hfa_z,
            "wfh": fu.baseline_wfh_z,
            "bmi": fu.baseline_bmi_z,
        }))
    ref = child.referrals.order_by("created_at", "id").first()
    if ref and any(v is not None for v in (ref.baseline_wfa_z, ref.baseline_hfa_z, ref.baseline_wfh_z, ref.baseline_bmi_z)):
        candidates.append((ref.created_at, {
            "wfa": ref.baseline_wfa_z,
            "hfa": ref.baseline_hfa_z,
            "wfh": ref.baseline_wfh_z,
            "bmi": ref.baseline_bmi_z,
        }))
    if not candidates:
        return None
    candidates.sort(key=lambda pair: pair[0])
    baseline = candidates[0][1]
    latest_z = {
        "wfa": latest.weight_for_age_z,
        "hfa": latest.height_for_age_z,
        "wfh": latest.weight_for_height_z,
        "bmi": latest.bmi_for_age_z,
    }
    return followups.calculate_progress(baseline, latest_z)


def recalculate_child_risk(child: Child) -> RiskAssessment:
    """Recompute and persist the child's rule-based RiskAssessment from measurements."""
    qs = list(child.measurements.order_by("date", "id"))
    if not qs:
        res = risk_rules.assess_risk(None, [])
        obj, _ = RiskAssessment.objects.update_or_create(
            child=child,
            defaults={"measurement": None, "level": res["level"], "reasons": res["reasons"]},
        )
        return obj

    rows = [
        {
            "date": m.date.isoformat(),
            "weight_kg": float(m.weight_kg),
            "status": m.status,
            "height_status": m.height_status,
            "wfh_status": m.wfh_status,
            "bmi_status": m.bmi_status,
            "is_flagged": m.is_flagged,
        }
        for m in qs
    ]
    t = trends.analyze_trends(rows)
    res = risk_rules.assess_risk(rows[-1], t)
    obj, _ = RiskAssessment.objects.update_or_create(
        child=child,
        defaults={"measurement": qs[-1], "level": res["level"], "reasons": res["reasons"]},
    )
    return obj
