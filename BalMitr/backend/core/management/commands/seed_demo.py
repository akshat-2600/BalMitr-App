from datetime import date, timedelta
from django.contrib.auth.models import User
from django.core.management import call_command
from django.core.management.base import BaseCommand

from core.models import Centre, Child, FollowUp, HomeVisit, Measurement, Profile, Referral
from core.services import recalculate_child_risk
from ml import growth


def dob_for_months(months: int, ref: date) -> date:
    """Return a fake DOB that yields exact `months` completed months on `ref`."""
    total_months = ref.year * 12 + (ref.month - 1) - months
    year, month0 = divmod(total_months, 12)
    day = min(ref.day, 28)
    d = date(year, month0 + 1, day)
    return d - timedelta(days=3)


def add_measurement(child: Child, on: date, weight_kg: float, height_cm: float, user: User, pos: str | None = None):
    r = growth.assess(child.sex, child.date_of_birth, weight_kg, height_cm, on=on, measured_position=pos)
    obj, _ = Measurement.objects.update_or_create(
        child=child,
        date=on,
        defaults={
            "weight_kg": weight_kg,
            "height_cm": height_cm,
            "measured_position": r["measured_position"],
            "adjusted_height_cm": r["adjusted_height_cm"],
            "age_months": r["age_months"],
            "weight_for_age_z": r["wfa"]["z_score"],
            "status": r["wfa"]["status"],
            "height_for_age_z": r["hfa"]["z_score"],
            "height_status": r["hfa"]["status"],
            "weight_for_height_z": r["wfh"]["z_score"],
            "wfh_status": r["wfh"]["status"],
            "bmi_for_age_z": r["bmi"]["z_score"],
            "bmi_status": r["bmi"]["status"],
            "is_flagged": r["is_flagged"],
            "flag_reasons": r["flag_reasons"],
            "measured_by": user,
        },
    )
    return obj


class Command(BaseCommand):
    help = "Create FAKE demo centres, users, children, and measurements (never real data)."

    def handle(self, *args, **opts):
        c1, _ = Centre.objects.update_or_create(
            code="AWC-001",
            defaults={"name": "Lotus Lane Anganwadi", "district": "Demo District"},
        )
        c2, _ = Centre.objects.update_or_create(
            code="AWC-002",
            defaults={"name": "Banyan Chowk Anganwadi", "district": "Demo District"},
        )
        user_objs = {}
        for username, full_name, role, centre in [
            ("worker1", "Meera Kole", "worker", c1),
            ("worker2", "Ravi Das", "worker", c2),
            ("supervisor1", "Anjali Sen", "supervisor", None),
        ]:
            user, _ = User.objects.get_or_create(username=username)
            user.set_password("demo1234")
            parts = full_name.split(" ", 1)
            user.first_name = parts[0]
            user.last_name = parts[1] if len(parts) > 1 else ""
            user.save()
            Profile.objects.update_or_create(
                user=user,
                defaults={"full_name": full_name, "role": role, "centre": centre},
            )
            user_objs[username] = user

        today = date.today()
        demo_children = [
            # Lotus Lane Anganwadi (5 children matching screenshot + 1 healthy 9y)
            {
                "centre": c1,
                "user": user_objs["worker1"],
                "name": "Aarav Sharma",
                "sex": "M",
                "months": 8,
                "guardian": "Kavita Sharma",
                "history": [
                    (60, 6.5, 64.5),
                    (30, 6.7, 65.8),
                    (2, 6.8, 66.8),
                ],
            },
            {
                "centre": c1,
                "user": user_objs["worker1"],
                "name": "Anaya Joshi",
                "sex": "F",
                "months": 14,
                "guardian": "Suman Joshi",
                "history": [
                    (60, 7.2, 70.0),
                    (30, 7.2, 71.0),
                    (2, 7.2, 72.0),
                ],
            },
            {
                "centre": c1,
                "user": user_objs["worker1"],
                "name": "Kabir Nair",
                "sex": "M",
                "months": 30,  # 2y 6m
                "guardian": "Deepa Nair",
                "history": [
                    (60, 11.6, 83.0),
                    (30, 11.9, 83.8),
                    (2, 12.1, 84.5),
                ],
            },
            {
                "centre": c1,
                "user": user_objs["worker1"],
                "name": "Vivaan Rao",
                "sex": "M",
                "months": 42,  # 3y 6m
                "guardian": "Lakshmi Rao",
                "history": [
                    (60, 11.8, 92.2),
                    (30, 11.2, 92.6),
                    (2, 10.6, 93.0),
                ],
            },
            {
                "centre": c1,
                "user": user_objs["worker1"],
                "name": "Diya Kulkarni",
                "sex": "F",
                "months": 111,  # 9y 3m
                "guardian": "Neha Kulkarni",
                "history": [
                    (60, 28.2, 132.5),
                    (30, 28.7, 133.2),
                    (2, 29.1, 134.0),
                ],
            },
            # Banyan Chowk Anganwadi (3 children including 7y and 11y)
            {
                "centre": c2,
                "user": user_objs["worker2"],
                "name": "Rohan Verma",
                "sex": "M",
                "months": 86,  # 7y 2m
                "guardian": "Pooja Verma",
                "history": [
                    (60, 22.1, 121.0),
                    (30, 22.5, 121.5),
                    (3, 22.8, 122.0),
                ],
            },
            {
                "centre": c2,
                "user": user_objs["worker2"],
                "name": "Mehek Patel",
                "sex": "F",
                "months": 132,  # 11y 0m
                "guardian": "Asha Patel",
                "history": [
                    (60, 27.4, 142.0),
                    (30, 27.2, 142.5),
                    (3, 27.0, 143.0),
                ],
            },
            {
                "centre": c2,
                "user": user_objs["worker2"],
                "name": "Reyansh Gupta",
                "sex": "M",
                "months": 20,  # 1y 8m
                "guardian": "Priya Gupta",
                "history": [
                    (60, 10.7, 82.0),
                    (30, 11.0, 83.2),
                    (3, 11.3, 84.2),
                ],
            },
        ]

        for item in demo_children:
            dob = dob_for_months(item["months"], today)
            child, _ = Child.objects.update_or_create(
                centre=item["centre"],
                name=item["name"],
                defaults={
                    "sex": item["sex"],
                    "date_of_birth": dob,
                    "guardian_name": item["guardian"],
                    "registered_by": item["user"],
                },
            )
            for days_ago, w, h in item["history"]:
                add_measurement(child, today - timedelta(days=days_ago), w, h, item["user"])
            recalculate_child_risk(child)

        # Seed sample follow-ups, visits, and referrals if none exist yet
        if FollowUp.objects.count() == 0:
            aarav = Child.objects.filter(name="Aarav Sharma").first()
            anaya = Child.objects.filter(name="Anaya Joshi").first()
            kabir = Child.objects.filter(name="Kabir Nair").first()
            vivaan = Child.objects.filter(name="Vivaan Rao").first()
            w1 = user_objs["worker1"]

            if aarav:
                first_m = aarav.measurements.order_by("date").first()
                FollowUp.objects.create(
                    child=aarav,
                    due_date=today,
                    reason="Re-weigh after complementary feeding counseling",
                    status="pending",
                    baseline_wfa_z=first_m.weight_for_age_z if first_m else None,
                    baseline_hfa_z=first_m.height_for_age_z if first_m else None,
                    baseline_wfh_z=first_m.weight_for_height_z if first_m else None,
                    created_by=w1,
                )
                HomeVisit.objects.create(
                    child=aarav,
                    visit_date=today - timedelta(days=7),
                    notes="Met guardian Kavita; advised mashed moong dal khichdi 3x daily.",
                    visited_by=w1,
                )
            if vivaan:
                first_m = vivaan.measurements.order_by("date").first()
                FollowUp.objects.create(
                    child=vivaan,
                    due_date=today - timedelta(days=4),
                    reason="Urgent weight check and NRC referral review",
                    status="overdue",
                    baseline_wfa_z=first_m.weight_for_age_z if first_m else None,
                    baseline_hfa_z=first_m.height_for_age_z if first_m else None,
                    baseline_wfh_z=first_m.weight_for_height_z if first_m else None,
                    created_by=w1,
                )
                Referral.objects.create(
                    child=vivaan,
                    facility="NRC District Hospital",
                    reason="Severely underweight with weight drop across visits",
                    status="open",
                    referred_date=today - timedelta(days=5),
                    baseline_wfa_z=first_m.weight_for_age_z if first_m else None,
                    baseline_hfa_z=first_m.height_for_age_z if first_m else None,
                    baseline_wfh_z=first_m.weight_for_height_z if first_m else None,
                    referred_by=w1,
                )
            if anaya:
                last_m = anaya.measurements.first()
                FollowUp.objects.create(
                    child=anaya,
                    due_date=today + timedelta(days=7),
                    reason="Check weight gain after sattu & dalia counseling",
                    status="pending",
                    baseline_wfa_z=last_m.weight_for_age_z if last_m else None,
                    baseline_hfa_z=last_m.height_for_age_z if last_m else None,
                    baseline_wfh_z=last_m.weight_for_height_z if last_m else None,
                    created_by=w1,
                )
            if kabir:
                first_m = kabir.measurements.order_by("date").first()
                FollowUp.objects.create(
                    child=kabir,
                    due_date=today - timedelta(days=10),
                    reason="Monthly height & diet check",
                    status="done",
                    completed_at=today - timedelta(days=9),
                    baseline_wfa_z=first_m.weight_for_age_z if first_m else None,
                    baseline_hfa_z=first_m.height_for_age_z if first_m else None,
                    baseline_wfh_z=first_m.weight_for_height_z if first_m else None,
                    created_by=w1,
                )

        call_command("import_foods")
        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {Centre.objects.count()} centres, {Child.objects.count()} children, "
                f"{Measurement.objects.count()} measurements."
            )
        )
