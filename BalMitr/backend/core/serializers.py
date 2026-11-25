from datetime import date
from django.conf import settings
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from ml import growth, risk_rules
from .models import Centre, Child, FollowUp, HomeVisit, Measurement, Referral
from .services import baseline_z_from_latest, compute_child_progress, recalculate_child_risk


class LoginSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        p = getattr(self.user, "profile", None)
        data["username"] = self.user.username
        data["full_name"] = (
            p.full_name
            if p and p.full_name
            else self.user.get_full_name() or self.user.username
        )
        data["role"] = p.role if p else None
        data["centre_id"] = p.centre_id if p else None
        data["centre_name"] = p.centre.name if p and p.centre else None
        return data


class CentreSerializer(serializers.ModelSerializer):
    class Meta:
        model = Centre
        fields = ["id", "name", "code", "district"]


class MeasurementSerializer(serializers.ModelSerializer):
    measured_position = serializers.ChoiceField(
        choices=["lying", "standing"], required=False, allow_null=True
    )

    class Meta:
        model = Measurement
        fields = [
            "id",
            "client_uuid",
            "child",
            "date",
            "weight_kg",
            "height_cm",
            "measured_position",
            "adjusted_height_cm",
            "age_months",
            "weight_for_age_z",
            "status",
            "height_for_age_z",
            "height_status",
            "weight_for_height_z",
            "wfh_status",
            "bmi_for_age_z",
            "bmi_status",
            "is_flagged",
            "flag_reasons",
            "created_at",
        ]
        read_only_fields = [
            "adjusted_height_cm",
            "age_months",
            "weight_for_age_z",
            "status",
            "height_for_age_z",
            "height_status",
            "weight_for_height_z",
            "wfh_status",
            "bmi_for_age_z",
            "bmi_status",
            "is_flagged",
            "flag_reasons",
            "created_at",
        ]

    def validate_weight_kg(self, v):
        if not (0.5 <= float(v) <= 100.0):
            raise serializers.ValidationError("Weight must be between 0.5 and 100 kg.")
        return v

    def validate_height_cm(self, v):
        if not (30.0 <= float(v) <= 185.0):
            raise serializers.ValidationError("Height must be between 30 and 185 cm.")
        return v

    def validate(self, data):
        child = data["child"]
        m_date = data["date"]
        if m_date > date.today():
            raise serializers.ValidationError({"date": "Measurement date cannot be in the future."})
        if m_date < child.date_of_birth:
            raise serializers.ValidationError({"date": "Date is before the child's date of birth."})
        months = growth.age_in_months(child.date_of_birth, m_date)
        if months > settings.BALMITR_MAX_AGE_MONTHS:
            raise serializers.ValidationError(
                {
                    "date": f"Measurements are only allowed up to {settings.BALMITR_MAX_AGE_MONTHS} months (12 years)."
                }
            )
        request = self.context.get("request")
        if request and hasattr(request.user, "profile"):
            profile = request.user.profile
            if profile.role == "worker" and child.centre_id != profile.centre_id:
                raise serializers.ValidationError({"child": "This child is not in your centre."})
        if Measurement.objects.filter(child=child, date=m_date).exists():
            raise serializers.ValidationError({"date": "A measurement for this date already exists."})
        return data

    def create(self, validated):
        child = validated["child"]
        pos = validated.get("measured_position")
        r = growth.assess(
            child.sex,
            child.date_of_birth,
            float(validated["weight_kg"]),
            float(validated["height_cm"]),
            on=validated["date"],
            measured_position=pos,
        )
        validated["measured_position"] = r["measured_position"]
        validated["adjusted_height_cm"] = r["adjusted_height_cm"]
        validated["age_months"] = r["age_months"]
        validated["weight_for_age_z"] = r["wfa"]["z_score"]
        validated["status"] = r["wfa"]["status"]
        validated["height_for_age_z"] = r["hfa"]["z_score"]
        validated["height_status"] = r["hfa"]["status"]
        validated["weight_for_height_z"] = r["wfh"]["z_score"]
        validated["wfh_status"] = r["wfh"]["status"]
        validated["bmi_for_age_z"] = r["bmi"]["z_score"]
        validated["bmi_status"] = r["bmi"]["status"]
        validated["is_flagged"] = r["is_flagged"]
        validated["flag_reasons"] = r["flag_reasons"]
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            validated["measured_by"] = request.user
        obj = super().create(validated)
        recalculate_child_risk(child)
        return obj


class ChildSerializer(serializers.ModelSerializer):
    age_months = serializers.SerializerMethodField()
    age_display = serializers.SerializerMethodField()
    centre_name = serializers.CharField(source="centre.name", read_only=True)
    latest = serializers.SerializerMethodField()
    status_chips = serializers.SerializerMethodField()
    risk = serializers.SerializerMethodField()
    progress = serializers.SerializerMethodField()

    class Meta:
        model = Child
        fields = [
            "id",
            "client_uuid",
            "centre",
            "centre_name",
            "name",
            "sex",
            "date_of_birth",
            "guardian_name",
            "age_months",
            "age_display",
            "latest",
            "status_chips",
            "risk",
            "progress",
            "created_at",
        ]
        read_only_fields = ["created_at"]

    def get_age_months(self, obj):
        return growth.age_in_months(obj.date_of_birth)

    def get_age_display(self, obj):
        return growth.format_age(growth.age_in_months(obj.date_of_birth))

    def get_latest(self, obj):
        m = obj.measurements.first()
        if not m:
            return None
        return MeasurementSerializer(m).data

    def get_status_chips(self, obj):
        m = obj.measurements.first()
        if not m:
            return []
        chips = []
        if m.age_months is not None and m.age_months <= 60:
            chips.extend([m.status, m.height_status, m.wfh_status])
        else:
            chips.extend([m.height_status, m.bmi_status])
            if m.wfa_z_applicable if hasattr(m, "wfa_z_applicable") else (m.weight_for_age_z is not None):
                chips.append(m.status)
        return [c for c in chips if c and c != "Not applicable for this age"]

    def get_risk(self, obj):
        r = getattr(obj, "risk", None)
        if not r:
            return {"level": "Low", "reasons": [{"rule_id": "RISK_NO_MEASUREMENT", "text": "No measurement recorded yet."}], "notice": risk_rules.RISK_NOTICE}
        return {
            "level": r.level,
            "reasons": r.reasons,
            "updated_at": r.updated_at,
            "notice": risk_rules.RISK_NOTICE,
        }

    def get_progress(self, obj):
        return compute_child_progress(obj)

    def validate_date_of_birth(self, value):
        if value > date.today():
            raise serializers.ValidationError("Date of birth cannot be in the future.")
        months = growth.age_in_months(value)
        if months > settings.BALMITR_MAX_AGE_MONTHS:
            raise serializers.ValidationError(
                f"Child must be {settings.BALMITR_MAX_AGE_MONTHS} completed months (12 years) or younger."
            )
        return value

    def validate_centre(self, centre):
        request = self.context.get("request")
        if request and hasattr(request.user, "profile"):
            profile = request.user.profile
            if profile.role == "worker" and profile.centre_id != centre.id:
                raise serializers.ValidationError("You can only register children in your own centre.")
        return centre


class FollowUpSerializer(serializers.ModelSerializer):
    child_name = serializers.CharField(source="child.name", read_only=True)
    centre_name = serializers.CharField(source="child.centre.name", read_only=True)

    class Meta:
        model = FollowUp
        fields = [
            "id",
            "child",
            "child_name",
            "centre_name",
            "due_date",
            "reason",
            "status",
            "baseline_wfa_z",
            "baseline_hfa_z",
            "baseline_wfh_z",
            "baseline_bmi_z",
            "completed_at",
            "created_at",
        ]
        read_only_fields = [
            "baseline_wfa_z",
            "baseline_hfa_z",
            "baseline_wfh_z",
            "baseline_bmi_z",
            "completed_at",
            "created_at",
        ]

    def validate_child(self, child):
        request = self.context.get("request")
        if request and hasattr(request.user, "profile"):
            p = request.user.profile
            if p.role == "worker" and child.centre_id != p.centre_id:
                raise serializers.ValidationError("This child is not in your centre.")
        return child

    def create(self, validated):
        child = validated["child"]
        z = baseline_z_from_latest(child)
        validated["baseline_wfa_z"] = z["wfa"]
        validated["baseline_hfa_z"] = z["hfa"]
        validated["baseline_wfh_z"] = z["wfh"]
        validated["baseline_bmi_z"] = z["bmi"]
        if validated.get("status") != "done" and validated["due_date"] < date.today():
            validated["status"] = "overdue"
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            validated["created_by"] = request.user
        return super().create(validated)

    def update(self, instance, validated):
        if validated.get("status") == "done" and not instance.completed_at:
            validated["completed_at"] = date.today()
        return super().update(instance, validated)


class HomeVisitSerializer(serializers.ModelSerializer):
    child_name = serializers.CharField(source="child.name", read_only=True)

    class Meta:
        model = HomeVisit
        fields = ["id", "child", "child_name", "visit_date", "notes", "created_at"]
        read_only_fields = ["created_at"]

    def validate_child(self, child):
        request = self.context.get("request")
        if request and hasattr(request.user, "profile"):
            p = request.user.profile
            if p.role == "worker" and child.centre_id != p.centre_id:
                raise serializers.ValidationError("This child is not in your centre.")
        return child

    def validate_visit_date(self, v):
        if v > date.today():
            raise serializers.ValidationError("Visit date cannot be in the future.")
        return v

    def create(self, validated):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            validated["visited_by"] = request.user
        return super().create(validated)


class ReferralSerializer(serializers.ModelSerializer):
    child_name = serializers.CharField(source="child.name", read_only=True)
    centre_name = serializers.CharField(source="child.centre.name", read_only=True)

    class Meta:
        model = Referral
        fields = [
            "id",
            "child",
            "child_name",
            "centre_name",
            "facility",
            "reason",
            "status",
            "referred_date",
            "baseline_wfa_z",
            "baseline_hfa_z",
            "baseline_wfh_z",
            "baseline_bmi_z",
            "created_at",
        ]
        read_only_fields = [
            "baseline_wfa_z",
            "baseline_hfa_z",
            "baseline_wfh_z",
            "baseline_bmi_z",
            "created_at",
        ]

    def validate_child(self, child):
        request = self.context.get("request")
        if request and hasattr(request.user, "profile"):
            p = request.user.profile
            if p.role == "worker" and child.centre_id != p.centre_id:
                raise serializers.ValidationError("This child is not in your centre.")
        return child

    def create(self, validated):
        child = validated["child"]
        z = baseline_z_from_latest(child)
        validated["baseline_wfa_z"] = z["wfa"]
        validated["baseline_hfa_z"] = z["hfa"]
        validated["baseline_wfh_z"] = z["wfh"]
        validated["baseline_bmi_z"] = z["bmi"]
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            validated["referred_by"] = request.user
        return super().create(validated)
