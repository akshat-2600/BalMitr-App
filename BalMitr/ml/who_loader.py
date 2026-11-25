"""Loader for official WHO LMS CSV tables in ml/who_tables/."""
import csv
from pathlib import Path

TABLE_DIR = Path(__file__).resolve().parent / "who_tables"
_cache: dict[str, dict[float, tuple[float, float, float]]] = {}


def load_csv_table(filename: str, key_col: str = "month", key_type=int) -> dict:
    """Load an LMS CSV file into {key: (L, M, S)} with in-memory caching."""
    if filename not in _cache:
        path = TABLE_DIR / filename
        if not path.exists():
            raise FileNotFoundError(f"Missing WHO table: {path}")
        with open(path, newline="", encoding="utf-8") as f:
            _cache[filename] = {
                key_type(row[key_col]): (float(row["L"]), float(row["M"]), float(row["S"]))
                for row in csv.DictReader(f)
            }
    return _cache[filename]


def get_wfa_lms(sex: str, months: int):
    """Return (L, M, S) for Weight-for-age (0-120 months) or None."""
    sfx = "boys" if sex == "M" else "girls"
    if 0 <= months <= 60:
        return load_csv_table(f"wfa_0_5_{sfx}.csv", "month", int).get(months)
    if 61 <= months <= 120:
        return load_csv_table(f"wfa_5_10_{sfx}.csv", "month", int).get(months)
    return None


def get_hfa_lms(sex: str, months: int):
    """Return (L, M, S) for Length/Height-for-age (0-144+ months) or None."""
    sfx = "boys" if sex == "M" else "girls"
    if 0 <= months <= 23:
        return load_csv_table(f"lhfa_0_2_{sfx}.csv", "month", int).get(months)
    if 24 <= months <= 60:
        return load_csv_table(f"lhfa_2_5_{sfx}.csv", "month", int).get(months)
    if 61 <= months <= 228:
        return load_csv_table(f"hfa_5_19_{sfx}.csv", "month", int).get(months)
    return None


def get_wfh_table(sex: str, months: int):
    """Return length/height-indexed LMS table for 0-60 months, or None above 60m."""
    sfx = "boys" if sex == "M" else "girls"
    if 0 <= months <= 23:
        return load_csv_table(f"wfl_0_2_{sfx}.csv", "length_cm", float)
    if 24 <= months <= 60:
        return load_csv_table(f"wfh_2_5_{sfx}.csv", "height_cm", float)
    return None


def get_bmi_lms(sex: str, months: int):
    """Return (L, M, S) for BMI-for-age (61-228 months) or None."""
    sfx = "boys" if sex == "M" else "girls"
    if 61 <= months <= 228:
        return load_csv_table(f"bmi_5_19_{sfx}.csv", "month", int).get(months)
    return None
