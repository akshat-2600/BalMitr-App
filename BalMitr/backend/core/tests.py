from datetime import date, timedelta

from django.contrib.auth.models import User
from rest_framework.test import APITestCase

from .models import Centre, Profile


def dob_for_exact_months(months: int, ref: date) -> date:
    total_months = ref.year * 12 + (ref.month - 1) - months
    year, month0 = divmod(total_months, 12)
    return date(year, month0 + 1, min(ref.day, 28))


class Phase1And2ApiTests(APITestCase):
    def setUp(self):
        self.c1 = Centre.objects.create(name="Lotus Lane Anganwadi", code="AWC-001")
        self.c2 = Centre.objects.create(name="Banyan Chowk Anganwadi", code="AWC-002")
        for name, full, role, centre in [
            ("w1", "Meera Kole", "worker", self.c1),
            ("w2", "Ravi Das", "worker", self.c2),
            ("sup", "Anjali Sen", "supervisor", None),
        ]:
            u = User.objects.create_user(name, password="pass12345")
            Profile.objects.create(user=u, full_name=full, role=role, centre=centre)

    def login(self, username):
        r = self.client.post("/api/auth/login/", {"username": username, "password": "pass12345"})
        self.assertEqual(r.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION="Bearer " + r.data["access"])
        return r.data

    def child_payload(self, centre, months=8, sex="M"):
        dob = dob_for_exact_months(months, date.today())
        return {
            "centre": centre.id,
            "name": "Test Child",
            "sex": sex,
            "date_of_birth": dob.isoformat(),
            "guardian_name": "Guardian",
        }

    def test_health_and_swagger(self):
        self.assertEqual(self.client.get("/api/health/").status_code, 200)
        self.assertEqual(self.client.get("/api/docs/").status_code, 200)

    def test_login_and_requires_auth(self):
        self.assertEqual(self.client.get("/api/children/").status_code, 401)
        data = self.login("w1")
        self.assertEqual(data["role"], "worker")
        self.assertEqual(data["full_name"], "Meera Kole")

    def test_centre_permissions_and_roles(self):
        self.login("w1")
        self.assertEqual(self.client.post("/api/centres/", {"name": "New", "code": "N1"}).status_code, 403)
        self.assertEqual(self.client.post("/api/children/", self.child_payload(self.c1)).status_code, 201)
        self.assertEqual(self.client.post("/api/children/", self.child_payload(self.c2)).status_code, 400)
        self.login("w2")
        self.assertEqual(len(self.client.get("/api/children/").data), 0)
        self.login("sup")
        self.assertEqual(len(self.client.get("/api/children/").data), 1)
        self.assertEqual(self.client.post("/api/centres/", {"name": "New", "code": "N1"}).status_code, 201)

    def test_age_limit_accepts_144_rejects_145(self):
        self.login("w1")
        ok = self.client.post("/api/children/", self.child_payload(self.c1, months=144))
        self.assertEqual(ok.status_code, 201)
        self.assertEqual(ok.data["age_months"], 144)

        bad = self.client.post("/api/children/", self.child_payload(self.c1, months=145))
        self.assertEqual(bad.status_code, 400)
        self.assertEqual(bad.data["error"]["code"], "validation_error")

    def test_measurement_validation_position_and_error_format(self):
        self.login("w1")
        cid = self.client.post("/api/children/", self.child_payload(self.c1, months=8)).data["id"]

        # Standing measurement for 8m child adds WHO 0.7 cm adjustment
        r = self.client.post(
            "/api/measurements/",
            {
                "child": cid,
                "date": date.today().isoformat(),
                "weight_kg": "6.70",
                "height_cm": "69.9",
                "measured_position": "standing",
            },
        )
        self.assertEqual(r.status_code, 201)
        self.assertEqual(float(r.data["adjusted_height_cm"]), 70.6)
        self.assertEqual(r.data["status"], "Underweight")

        # Duplicate date rejected with unified error format
        dup = self.client.post(
            "/api/measurements/",
            {"child": cid, "date": date.today().isoformat(), "weight_kg": "6.80", "height_cm": "70.0"},
        )
        self.assertEqual(dup.status_code, 400)
        self.assertEqual(dup.data["error"]["code"], "validation_error")
        self.assertIn("message", dup.data["error"])

        # Future date & out-of-range weight rejected
        fut = self.client.post(
            "/api/measurements/",
            {"child": cid, "date": (date.today() + timedelta(days=1)).isoformat(), "weight_kg": "6.8", "height_cm": "70"},
        )
        self.assertEqual(fut.status_code, 400)
        bad_w = self.client.post(
            "/api/measurements/",
            {"child": cid, "date": (date.today() - timedelta(days=1)).isoformat(), "weight_kg": "150", "height_cm": "70"},
        )
        self.assertEqual(bad_w.status_code, 400)

    def test_over_5_measurement_uses_who_2007_and_marks_wfh_na(self):
        self.login("w1")
        cid = self.client.post("/api/children/", self.child_payload(self.c1, months=132, sex="F")).data["id"]
        r = self.client.post(
            "/api/measurements/",
            {"child": cid, "date": date.today().isoformat(), "weight_kg": "27.0", "height_cm": "143.0"},
        )
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["wfh_status"], "Not applicable for this age")
        self.assertEqual(r.data["status"], "Not applicable for this age")
        self.assertEqual(r.data["bmi_status"], "Thinness")

        hist = self.client.get(f"/api/children/{cid}/growth-history/")
        self.assertEqual(hist.status_code, 200)
        self.assertFalse(hist.data["charts"]["wfh"]["applicable"])
        self.assertTrue(hist.data["charts"]["bmi"]["applicable"])
        self.assertEqual(len(hist.data["measurements"]), 1)

    def test_import_foods_and_suggestions_endpoint(self):
        from django.core.management import call_command
        call_command("import_foods")
        self.login("w1")
        cid = self.client.post("/api/children/", self.child_payload(self.c1, months=8)).data["id"]
        self.client.post(
            "/api/measurements/",
            {"child": cid, "date": date.today().isoformat(), "weight_kg": "6.8", "height_cm": "66.8"},
        )
        r = self.client.get(f"/api/children/{cid}/food-suggestions/")
        self.assertEqual(r.status_code, 200)
        self.assertIn("nutrition expert", r.data["notice"])
        for item in r.data["suggestions"]:
            self.assertFalse(item["has_honey"])
            self.assertFalse(item["is_whole_nut"])

    def test_risk_and_alerts_sorted_high_first(self):
        self.login("w1")
        # Child 1: Moderate (Underweight)
        c_mod = self.client.post("/api/children/", self.child_payload(self.c1, months=8)).data["id"]
        self.client.post("/api/measurements/", {"child": c_mod, "date": date.today().isoformat(), "weight_kg": "6.8", "height_cm": "66.8"})
        # Child 2: High (Severely underweight)
        c_high = self.client.post("/api/children/", {**self.child_payload(self.c1, months=42), "name": "Alpha Severe"}).data["id"]
        self.client.post("/api/measurements/", {"child": c_high, "date": date.today().isoformat(), "weight_kg": "10.3", "height_cm": "93.0"})

        alerts = self.client.get("/api/alerts/")
        self.assertEqual(alerts.status_code, 200)
        self.assertEqual(len(alerts.data), 2)
        self.assertEqual(alerts.data[0]["risk"]["level"], "High")
        self.assertEqual(alerts.data[1]["risk"]["level"], "Moderate")

    def test_follow_up_overdue_and_progress(self):
        from django.core.management import call_command
        from .models import FollowUp, Child
        self.login("w1")
        cid = self.client.post("/api/children/", self.child_payload(self.c1, months=8)).data["id"]
        # First measurement (underweight)
        self.client.post(
            "/api/measurements/",
            {"child": cid, "date": (date.today() - timedelta(days=30)).isoformat(), "weight_kg": "6.5", "height_cm": "66.0"},
        )
        # Create follow-up due 2 days ago (pending at first if created directly in DB)
        fu = FollowUp.objects.create(
            child=Child.objects.get(id=cid),
            due_date=date.today() - timedelta(days=2),
            reason="Follow up weight",
            status="pending",
            baseline_wfa_z=-2.5,
        )
        call_command("flag_overdue")
        fu.refresh_from_db()
        self.assertEqual(fu.status, "overdue")

        # Newer measurement improves Z-score
        self.client.post(
            "/api/measurements/",
            {"child": cid, "date": date.today().isoformat(), "weight_kg": "7.5", "height_cm": "68.0"},
        )
        child_data = self.client.get(f"/api/children/{cid}/").data
        self.assertEqual(child_data["progress"]["status"], "improved")

    def test_sync_idempotency_and_server_recalculation(self):
        import uuid
        from .models import Child, Measurement
        self.login("w1")
        child_uuid = str(uuid.uuid4())
        meas_uuid = str(uuid.uuid4())
        dob = dob_for_exact_months(8, date.today()).isoformat()
        batch = {
            "items": [
                {
                    "client_uuid": child_uuid,
                    "type": "child",
                    "payload": {
                        "name": "Offline Baby",
                        "sex": "M",
                        "date_of_birth": dob,
                        "guardian_name": "Meena",
                        "centre": self.c1.id,
                    },
                },
                {
                    "client_uuid": meas_uuid,
                    "type": "measurement",
                    "payload": {
                        "child_client_uuid": child_uuid,
                        "date": date.today().isoformat(),
                        "weight_kg": "6.8",
                        "height_cm": "66.8",
                        "status": "Normal",  # client-tampered value must be ignored
                    },
                },
            ]
        }
        r1 = self.client.post("/api/sync/", batch, format="json")
        self.assertEqual(r1.status_code, 200)
        self.assertEqual(r1.data["summary"]["synced"], 2)
        self.assertEqual(r1.data["results"][1]["data"]["status"], "Underweight")

        # Retrying exact same batch must be idempotent (no duplicates)
        r2 = self.client.post("/api/sync/", batch, format="json")
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(r2.data["summary"]["already_synced"], 2)
        self.assertEqual(Child.objects.filter(client_uuid=child_uuid).count(), 1)
        self.assertEqual(Measurement.objects.filter(client_uuid=meas_uuid).count(), 1)

    def test_summary_endpoint_scoping(self):
        self.login("w1")
        self.client.post("/api/children/", self.child_payload(self.c1, months=8))
        r_w1 = self.client.get("/api/summary/")
        self.assertEqual(r_w1.status_code, 200)
        self.assertEqual(len(r_w1.data["centres"]), 1)

        self.login("sup")
        r_sup = self.client.get("/api/summary/")
        self.assertEqual(r_sup.status_code, 200)
        self.assertEqual(len(r_sup.data["centres"]), 2)
