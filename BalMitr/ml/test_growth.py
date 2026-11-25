"""Unit tests comparing BalMitr LMS calculator against official WHO tables.

Includes at least 5 verification cases per age group (0-60m and 61-144m),
covering both boys ('M') and girls ('F').
"""
import json
import unittest
from datetime import date
from pathlib import Path
from ml import followups, food_rules, growth, risk_rules, trends, who_loader


class WhoTableAndCalculatorTests(unittest.TestCase):
    def test_all_tables_loaded(self):
        self.assertIsNotNone(who_loader.get_wfa_lms("M", 0))
        self.assertIsNotNone(who_loader.get_wfa_lms("F", 60))
        self.assertIsNotNone(who_loader.get_wfa_lms("M", 61))
        self.assertIsNotNone(who_loader.get_wfa_lms("F", 120))
        self.assertIsNone(who_loader.get_wfa_lms("M", 121))
        self.assertIsNotNone(who_loader.get_hfa_lms("M", 0))
        self.assertIsNotNone(who_loader.get_hfa_lms("M", 24))
        self.assertIsNotNone(who_loader.get_hfa_lms("F", 144))
        self.assertIsNotNone(who_loader.get_wfh_table("M", 12))
        self.assertIsNotNone(who_loader.get_wfh_table("F", 48))
        self.assertIsNone(who_loader.get_wfh_table("M", 61))
        self.assertIsNotNone(who_loader.get_bmi_lms("M", 61))
        self.assertIsNotNone(who_loader.get_bmi_lms("F", 144))

    def test_age_format_and_max_limit(self):
        self.assertEqual(growth.MAX_AGE_MONTHS, 144)
        self.assertEqual(growth.format_age(8), "8 months")
        self.assertEqual(growth.format_age(30), "2y 6m")
        self.assertEqual(growth.format_age(111), "9y 3m")
        # 144 months accepted, 145 rejected
        res_144 = growth.assess("M", date(2014, 1, 1), 40.0, 149.0, on=date(2026, 1, 1))
        self.assertEqual(res_144["age_months"], 144)
        with self.assertRaises(ValueError):
            growth.assess("M", date(2013, 12, 1), 40.0, 149.0, on=date(2026, 1, 1))

    def test_lying_standing_0_7_cm_adjustment(self):
        # 8 months boy measured standing at 69.3 -> adjusted to 70.0 lying length
        adj, pos, applied = growth.adjust_height_for_age(69.3, 8, "standing")
        self.assertEqual(adj, 70.0)
        self.assertEqual(pos, "standing")
        self.assertTrue(applied)
        # 30 months boy measured lying at 90.7 -> adjusted to 90.0 standing height
        adj2, pos2, applied2 = growth.adjust_height_for_age(90.7, 30, "lying")
        self.assertEqual(adj2, 90.0)
        self.assertEqual(pos2, "lying")
        self.assertTrue(applied2)

    def test_under_5_official_who_cases(self):
        """5+ cases for 0-60 months checked directly against WHO SD tables."""
        on = date(2026, 7, 1)
        # Case 1: Boy 0m at WHO median (W=3.3464 kg, L=49.8842 cm) -> Z=0.0
        r1 = growth.assess("M", date(2026, 7, 1), 3.3464, 49.9, on=on)
        self.assertAlmostEqual(r1["wfa"]["z_score"], 0.0, places=1)
        self.assertEqual(r1["wfa"]["status"], "Normal")
        self.assertEqual(r1["hfa"]["status"], "Normal")

        # Case 2: Boy 8m underweight (W=6.8 kg, L=70.6 cm)
        # WHO 8m boy WFA: SD2neg=6.9 -> 6.8 kg is < -2 SD (Underweight)
        r2 = growth.assess("M", date(2025, 11, 1), 6.8, 70.6, on=on)
        self.assertLess(r2["wfa"]["z_score"], -2.0)
        self.assertEqual(r2["wfa"]["status"], "Underweight")

        # Case 3: Girl 14m underweight (W=7.1 kg, L=76.0 cm)
        # WHO 14m girl WFA: SD2neg=7.39, SD3neg=6.59 -> 7.1 kg is Underweight
        r3 = growth.assess("F", date(2025, 5, 1), 7.1, 76.0, on=on)
        self.assertEqual(r3["wfa"]["status"], "Underweight")

        # Case 4: Boy 30m (2y 6m) stunted (W=12.8 kg, H=83.0 cm)
        # WHO 30m boy HFA: SD2neg=85.1, SD3neg=81.7 -> 83.0 is Stunted
        r4 = growth.assess("M", date(2024, 1, 1), 12.8, 83.0, on=on)
        self.assertEqual(r4["hfa"]["status"], "Stunted")
        self.assertEqual(r4["bmi"]["status"], "Not applicable for this age")

        # Case 5: Boy 42m (3y 6m) severely underweight (W=10.5 kg, H=96.0 cm)
        # WHO 42m boy WFA: SD3neg=10.9 -> 10.5 is Severely underweight
        r5 = growth.assess("M", date(2023, 1, 1), 10.5, 96.0, on=on)
        self.assertEqual(r5["wfa"]["status"], "Severely underweight")

        # Case 6: Girl 24m wasted (W=8.6 kg, H=85.7 cm standing)
        # WHO 24m girl WFH at 85.7 cm median is ~11.5 kg; 8.6 kg is < -3 SD (Severely wasted)
        r6 = growth.assess("F", date(2024, 7, 1), 8.6, 85.7, on=on)
        self.assertEqual(r6["wfh"]["status"], "Severely wasted")

    def test_5_to_12_official_who_2007_cases(self):
        """5+ cases for 61-144 months checked against WHO 2007 Reference tables."""
        on = date(2026, 7, 1)
        # Case 1: Boy 61m (5y 1m) at WHO 2007 HFA median (110.2647 cm) and BMI median (15.2641)
        # Weight = 15.2641 * 1.102647^2 = 18.558 kg
        r1 = growth.assess("M", date(2021, 6, 1), 18.56, 110.3, on=on)
        self.assertAlmostEqual(r1["hfa"]["z_score"], 0.0, places=1)
        self.assertAlmostEqual(r1["bmi"]["z_score"], 0.0, places=1)
        self.assertEqual(r1["wfh"]["status"], "Not applicable for this age")

        # Case 2: Girl 84m (7y 0m) normal growth (H=120.8 cm, W=22.4 kg)
        r2 = growth.assess("F", date(2019, 7, 1), 22.4, 120.8, on=on)
        self.assertEqual(r2["hfa"]["status"], "Normal")
        self.assertEqual(r2["bmi"]["status"], "Normal")
        self.assertEqual(r2["wfa"]["status"], "Normal")

        # Case 3: Boy 108m (9y 0m) stunted and thinness
        # WHO 108m boy HFA SD2neg ~ 121.5 -> 118.0 is Stunted; BMI at W=18.0, H=118 -> BMI=12.93 (< -2 SD Thinness)
        r3 = growth.assess("M", date(2017, 7, 1), 18.0, 118.0, on=on)
        self.assertEqual(r3["hfa"]["status"], "Stunted")
        self.assertEqual(r3["bmi"]["status"], "Thinness")

        # Case 4: Girl 114m (9y 6m) overweight (BMI > +1 SD and <= +2 SD)
        # WHO 114m girl BMI SD1 ~ 19.3, SD2 ~ 22.2 -> BMI=20.5 at H=135cm (W=37.4 kg)
        r4 = growth.assess("F", date(2017, 1, 1), 37.4, 135.0, on=on)
        self.assertEqual(r4["bmi"]["status"], "Overweight")

        # Case 5: Boy 132m (11y 0m) WFA not applicable above 120m, obesity (> +2 SD BMI)
        # WHO 132m boy BMI SD2 ~ 23.2 -> BMI=25.0 at H=143cm (W=51.1 kg)
        r5 = growth.assess("M", date(2015, 7, 1), 51.1, 143.0, on=on)
        self.assertEqual(r5["wfa"]["status"], "Not applicable for this age")
        self.assertEqual(r5["wfh"]["status"], "Not applicable for this age")
        self.assertEqual(r5["bmi"]["status"], "Obesity")

    def test_who_flag_limits(self):
        on = date(2026, 7, 1)
        # Implausible weight 35 kg for an 8-month-old boy -> flagged
        r = growth.assess("M", date(2025, 11, 1), 35.0, 70.0, on=on)
        self.assertTrue(r["is_flagged"])
        self.assertTrue(len(r["flag_reasons"]) > 0)

    def test_trend_rules_and_sd_curves(self):
        history = [
            {"date": "2026-09-01", "weight_kg": 11.8, "status": "Underweight", "height_status": "Normal", "wfh_status": "Normal", "bmi_status": "Not applicable for this age"},
            {"date": "2026-10-01", "weight_kg": 11.8, "status": "Underweight", "height_status": "Normal", "wfh_status": "Normal", "bmi_status": "Not applicable for this age"},
            {"date": "2026-11-01", "weight_kg": 10.6, "status": "Severely underweight", "height_status": "Normal", "wfh_status": "Normal", "bmi_status": "Not applicable for this age"},
        ]
        t = trends.analyze_trends(history)
        codes = [x["code"] for x in t]
        self.assertIn("TREND_WEIGHT_DROP", codes)
        self.assertIn("TREND_CROSSED_WORSE", codes)

        no_gain = [
            {"date": "2026-09-01", "weight_kg": 7.2, "status": "Underweight", "height_status": "Normal", "wfh_status": "Normal", "bmi_status": ""},
            {"date": "2026-10-01", "weight_kg": 7.2, "status": "Underweight", "height_status": "Normal", "wfh_status": "Normal", "bmi_status": ""},
            {"date": "2026-11-01", "weight_kg": 7.2, "status": "Underweight", "height_status": "Normal", "wfh_status": "Normal", "bmi_status": ""},
        ]
        self.assertIn("TREND_NO_GAIN_TWO_VISITS", [x["code"] for x in trends.analyze_trends(no_gain)])

        curves_u5 = trends.build_growth_curves("M", 24)
        self.assertTrue(curves_u5["wfh"]["applicable"])
        self.assertFalse(curves_u5["bmi"]["applicable"])
        curves_o5 = trends.build_growth_curves("F", 132)
        self.assertFalse(curves_o5["wfh"]["applicable"])
        self.assertFalse(curves_o5["wfa"]["applicable"])
        self.assertTrue(curves_o5["bmi"]["applicable"])

    def test_food_safety_rules(self):
        foods = json.loads((Path(__file__).parent / "foods.json").read_text(encoding="utf-8"))
        # Under 6m -> no solid foods
        r4 = food_rules.suggest_foods(foods, 4, ["Normal"])
        self.assertEqual(r4["suggestions"], [])
        self.assertIn("needs review by a nutrition expert", r4["notice"])

        # 8m underweight -> needs energy & protein, no honey, no whole nuts, no solid texture
        r8 = food_rules.suggest_foods(foods, 8, ["Underweight"])
        self.assertIn("energy", r8["needs"])
        self.assertIn("protein", r8["needs"])
        self.assertTrue(len(r8["suggestions"]) > 0)
        for item in r8["suggestions"]:
            self.assertFalse(item["has_honey"])
            self.assertFalse(item["is_whole_nut"])
            self.assertNotEqual(item["texture"], "solid")

        # 24m -> no whole nuts under 36m
        r24 = food_rules.suggest_foods(foods, 24, ["Stunted"], limit=25)
        for item in r24["suggestions"]:
            self.assertFalse(item["is_whole_nut"])

    def test_risk_rules(self):
        # Severe underweight -> High with RISK_SEV_WFA
        high = risk_rules.assess_risk({"status": "Severely underweight", "height_status": "Normal", "wfh_status": "Normal"})
        self.assertEqual(high["level"], "High")
        self.assertIn("RISK_SEV_WFA", [r["rule_id"] for r in high["reasons"]])
        self.assertIn("needs expert review", high["notice"].lower())

        # Moderate underweight only -> Moderate
        mod = risk_rules.assess_risk({"status": "Underweight", "height_status": "Normal", "wfh_status": "Normal"})
        self.assertEqual(mod["level"], "Moderate")

        # 2 moderate deficits + weight drop -> High (RISK_MULTI_MOD_DROP)
        multi = risk_rules.assess_risk(
            {"status": "Underweight", "height_status": "Stunted", "wfh_status": "Normal"},
            [{"code": "TREND_WEIGHT_DROP"}],
        )
        self.assertEqual(multi["level"], "High")
        self.assertIn("RISK_MULTI_MOD_DROP", [r["rule_id"] for r in multi["reasons"]])

        # Normal -> Low
        low = risk_rules.assess_risk({"status": "Normal", "height_status": "Normal", "wfh_status": "Normal"})
        self.assertEqual(low["level"], "Low")

    def test_progress_calculation(self):
        imp = followups.calculate_progress({"wfa": -2.5, "hfa": -1.5}, {"wfa": -2.0, "hfa": -1.4})
        self.assertEqual(imp["status"], "improved")
        same = followups.calculate_progress({"wfa": -2.1}, {"wfa": -2.0})
        self.assertEqual(same["status"], "same")
        worse = followups.calculate_progress({"wfa": -2.3}, {"wfa": -3.1})
        self.assertEqual(worse["status"], "worse")


if __name__ == "__main__":
    unittest.main()
