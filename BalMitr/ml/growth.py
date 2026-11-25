"""Rule-based WHO LMS growth calculator for children 0 to 144 completed months.

Uses official WHO Child Growth Standards (0-60 months) and WHO 2007 Growth
Reference (61-144 months). Not machine learning.
"""
import math
from datetime import date

from ml.who_loader import get_bmi_lms, get_hfa_lms, get_wfa_lms, get_wfh_table

MAX_AGE_MONTHS = 144


def age_in_months(dob: date, on: date | None = None) -> int:
    """Completed months between date of birth and measurement date."""
    on = on or date.today()
    if on < dob:
        raise ValueError("Measurement date cannot be before date of birth.")
    months = (on.year - dob.year) * 12 + (on.month - dob.month)
    if on.day < dob.day:
        months -= 1
    return months


def format_age(months: int) -> str:
    """Format completed months as '8 months', '14 months', '2y 6m', or '9y 3m'."""
    if months < 24:
        return "1 month" if months == 1 else f"{months} months"
    years, rem = divmod(months, 12)
    return f"{years}y {rem}m"


def z_score(x: float, L: float, M: float, S: float) -> float:
    """Compute WHO LMS Z-score."""
    if L == 0:
        return math.log(x / M) / S
    return ((x / M) ** L - 1) / (L * S)


def value_from_z(z: float, L: float, M: float, S: float) -> float:
    """Invert WHO LMS formula to get the measurement value at a given Z-score."""
    if L == 0:
        return M * math.exp(S * z)
    return M * ((1 + L * S * z) ** (1 / L))


def adjust_height_for_age(
    height_cm: float, age_months: int, measured_position: str | None = None
) -> tuple[float, str, bool]:
    """Apply WHO 0.7 cm adjustment when measuring position differs from standard.

    Under 24 months: standard is lying (length); standing height -> add 0.7 cm.
    24+ months: standard is standing (height); lying length -> subtract 0.7 cm.
    Returns (adjusted_height_cm, position_used, adjustment_applied).
    """
    expected = "lying" if age_months < 24 else "standing"
    pos = measured_position or expected
    if pos not in ("lying", "standing"):
        raise ValueError("measured_position must be 'lying' or 'standing'.")
    if age_months < 24 and pos == "standing":
        return round(height_cm + 0.7, 2), pos, True
    if age_months >= 24 and pos == "lying":
        return round(height_cm - 0.7, 2), pos, True
    return round(height_cm, 2), pos, False


def wfa_status_from_z(z: float) -> str:
    if z < -3:
        return "Severely underweight"
    if z < -2:
        return "Underweight"
    if z <= 2:
        return "Normal"
    return "Above normal weight-for-age"


def hfa_status_from_z(z: float) -> str:
    if z < -3:
        return "Severely stunted"
    if z < -2:
        return "Stunted"
    if z <= 3:
        return "Normal"
    return "Tall"


def wfh_status_from_z(z: float) -> str:
    if z < -3:
        return "Severely wasted"
    if z < -2:
        return "Wasted"
    if z <= 1:
        return "Normal"
    if z <= 2:
        return "Possible risk of overweight"
    if z <= 3:
        return "Overweight"
    return "Obese"


def bmi_status_from_z(z: float) -> str:
    if z < -3:
        return "Severe thinness"
    if z < -2:
        return "Thinness"
    if z <= 1:
        return "Normal"
    if z <= 2:
        return "Overweight"
    return "Obesity"


def _interpolate_wfh_lms(table: dict[float, tuple[float, float, float]], height_cm: float):
    """Interpolate LMS values by 0.1 cm within WHO weight-for-length/height tables."""
    keys = sorted(table.keys())
    if height_cm < keys[0] or height_cm > keys[-1]:
        return None
    rounded = round(height_cm, 1)
    if rounded in table:
        return table[rounded]
    lo = max(k for k in keys if k <= height_cm)
    hi = min(k for k in keys if k >= height_cm)
    if lo == hi:
        return table[lo]
    t = (height_cm - lo) / (hi - lo)
    l1, m1, s1 = table[lo]
    l2, m2, s2 = table[hi]
    return (l1 + t * (l2 - l1), m1 + t * (m2 - m1), s1 + t * (s2 - s1))


def assess(
    sex: str,
    dob: date,
    weight_kg: float,
    height_cm: float,
    on: date | None = None,
    measured_position: str | None = None,
) -> dict:
    """Compute all WHO indicators applicable for age (0-144 completed months)."""
    if sex not in ("M", "F"):
        raise ValueError("sex must be 'M' or 'F'.")
    months = age_in_months(dob, on)
    if months > MAX_AGE_MONTHS:
        raise ValueError(
            f"Child age ({months} months) exceeds maximum allowed age of {MAX_AGE_MONTHS} months (12 years)."
        )

    adj_height, pos, adj_applied = adjust_height_for_age(height_cm, months, measured_position)
    flags: list[str] = []

    # 1. Weight-for-age: 0-120 months (WHO 0-5y and WHO 2007 5-10y)
    wfa_lms = get_wfa_lms(sex, months)
    if wfa_lms is not None:
        wfa_z = round(z_score(weight_kg, *wfa_lms), 2)
        wfa = {"z_score": wfa_z, "status": wfa_status_from_z(wfa_z)}
        if wfa_z < -6 or wfa_z > 5:
            flags.append(f"Weight-for-age Z-score ({wfa_z}) is outside WHO plausible limits (-6 to +5).")
    else:
        wfa = {"z_score": None, "status": "Not applicable for this age"}

    # 2. Length/Height-for-age: 0-144 months
    hfa_lms = get_hfa_lms(sex, months)
    hfa_z = round(z_score(adj_height, *hfa_lms), 2)
    hfa = {"z_score": hfa_z, "status": hfa_status_from_z(hfa_z)}
    if hfa_z < -6 or hfa_z > 6:
        flags.append(f"Height-for-age Z-score ({hfa_z}) is outside WHO plausible limits (-6 to +6).")

    # 3. Weight-for-length/height: 0-60 months only
    if months <= 60:
        wfh_table = get_wfh_table(sex, months)
        wfh_lms = _interpolate_wfh_lms(wfh_table, adj_height)
        if wfh_lms is not None:
            wfh_z = round(z_score(weight_kg, *wfh_lms), 2)
            wfh = {"z_score": wfh_z, "status": wfh_status_from_z(wfh_z)}
            if wfh_z < -5 or wfh_z > 5:
                flags.append(
                    f"Weight-for-height Z-score ({wfh_z}) is outside WHO plausible limits (-5 to +5)."
                )
        else:
            wfh = {"z_score": None, "status": "Height outside WHO WFH range"}
        bmi = {"z_score": None, "status": "Not applicable for this age", "bmi": None}
    else:
        # 4. 61-144 months: WFH does not apply; BMI-for-age applies
        wfh = {"z_score": None, "status": "Not applicable for this age"}
        bmi_val = round(weight_kg / ((adj_height / 100.0) ** 2), 2)
        bmi_lms = get_bmi_lms(sex, months)
        bmi_z = round(z_score(bmi_val, *bmi_lms), 2)
        bmi = {"z_score": bmi_z, "status": bmi_status_from_z(bmi_z), "bmi": bmi_val}
        if bmi_z < -5 or bmi_z > 5:
            flags.append(
                f"BMI-for-age Z-score ({bmi_z}) is outside WHO plausible limits (-5 to +5)."
            )

    return {
        "age_months": months,
        "age_display": format_age(months),
        "measured_position": pos,
        "adjusted_height_cm": adj_height,
        "height_adjustment_applied": adj_applied,
        "wfa": wfa,
        "hfa": hfa,
        "wfh": wfh,
        "bmi": bmi,
        "is_flagged": len(flags) > 0,
        "flag_reasons": flags,
    }
