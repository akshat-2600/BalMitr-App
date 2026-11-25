import uuid
from django.conf import settings
from django.db import models


class Centre(models.Model):
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=20, unique=True)
    district = models.CharField(max_length=60, blank=True)

    def __str__(self):
        return f"{self.name} ({self.code})"


class Profile(models.Model):
    ROLES = [("worker", "Anganwadi Worker"), ("supervisor", "Supervisor")]
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile"
    )
    full_name = models.CharField(max_length=120, blank=True)
    role = models.CharField(max_length=12, choices=ROLES, default="worker")
    centre = models.ForeignKey(Centre, null=True, blank=True, on_delete=models.SET_NULL)

    def __str__(self):
        return f"{self.full_name or self.user.username} ({self.role})"


class Child(models.Model):
    SEX = [("M", "Boy"), ("F", "Girl")]
    client_uuid = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    centre = models.ForeignKey(Centre, on_delete=models.PROTECT, related_name="children")
    name = models.CharField(max_length=100)
    sex = models.CharField(max_length=1, choices=SEX)
    date_of_birth = models.DateField()
    guardian_name = models.CharField(max_length=100, blank=True)
    registered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Measurement(models.Model):
    POSITIONS = [("lying", "Lying (length)"), ("standing", "Standing (height)")]
    client_uuid = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    child = models.ForeignKey(Child, on_delete=models.CASCADE, related_name="measurements")
    date = models.DateField()
    weight_kg = models.DecimalField(max_digits=5, decimal_places=2)
    height_cm = models.DecimalField(max_digits=5, decimal_places=1)
    measured_position = models.CharField(max_length=10, choices=POSITIONS, default="standing")
    adjusted_height_cm = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    age_months = models.IntegerField(null=True, blank=True)
    # Indicator Z-scores and status labels
    weight_for_age_z = models.FloatField(null=True, blank=True)
    status = models.CharField(max_length=60, blank=True)
    height_for_age_z = models.FloatField(null=True, blank=True)
    height_status = models.CharField(max_length=60, blank=True)
    weight_for_height_z = models.FloatField(null=True, blank=True)
    wfh_status = models.CharField(max_length=60, blank=True)
    bmi_for_age_z = models.FloatField(null=True, blank=True)
    bmi_status = models.CharField(max_length=60, blank=True)
    is_flagged = models.BooleanField(default=False)
    flag_reasons = models.JSONField(default=list, blank=True)
    measured_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-id"]


class FoodItem(models.Model):
    TEXTURES = [("liquid", "Liquid"), ("mashed", "Mashed"), ("soft", "Soft"), ("solid", "Solid")]
    name = models.CharField(max_length=120, unique=True)
    local_name = models.CharField(max_length=120, blank=True)
    min_age_months = models.IntegerField(default=6)
    texture = models.CharField(max_length=12, choices=TEXTURES, default="soft")
    has_honey = models.BooleanField(default=False)
    is_whole_nut = models.BooleanField(default=False)
    tag_energy = models.BooleanField(default=False)
    tag_protein = models.BooleanField(default=False)
    tag_iron = models.BooleanField(default=False)
    tag_vitamin_a = models.BooleanField(default=False)
    serving_note = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ["min_age_months", "name"]

    def __str__(self):
        return self.name


class RiskAssessment(models.Model):
    LEVELS = [("Low", "Low"), ("Moderate", "Moderate"), ("High", "High")]
    child = models.OneToOneField(Child, on_delete=models.CASCADE, related_name="risk")
    measurement = models.ForeignKey(
        Measurement, null=True, blank=True, on_delete=models.SET_NULL
    )
    level = models.CharField(max_length=12, choices=LEVELS, default="Low")
    reasons = models.JSONField(default=list, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.child.name}: {self.level}"


class FollowUp(models.Model):
    STATUSES = [("pending", "Pending"), ("overdue", "Overdue"), ("done", "Done")]
    child = models.ForeignKey(Child, on_delete=models.CASCADE, related_name="follow_ups")
    due_date = models.DateField()
    reason = models.CharField(max_length=200)
    status = models.CharField(max_length=12, choices=STATUSES, default="pending")
    baseline_wfa_z = models.FloatField(null=True, blank=True)
    baseline_hfa_z = models.FloatField(null=True, blank=True)
    baseline_wfh_z = models.FloatField(null=True, blank=True)
    baseline_bmi_z = models.FloatField(null=True, blank=True)
    completed_at = models.DateField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["due_date", "-id"]

    def __str__(self):
        return f"{self.child.name} due {self.due_date} ({self.status})"


class HomeVisit(models.Model):
    child = models.ForeignKey(Child, on_delete=models.CASCADE, related_name="visits")
    visit_date = models.DateField()
    notes = models.TextField()
    visited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-visit_date", "-id"]

    def __str__(self):
        return f"{self.child.name} visit {self.visit_date}"


class Referral(models.Model):
    STATUSES = [("open", "Open"), ("visited", "Visited"), ("closed", "Closed")]
    child = models.ForeignKey(Child, on_delete=models.CASCADE, related_name="referrals")
    facility = models.CharField(max_length=120)
    reason = models.CharField(max_length=200)
    status = models.CharField(max_length=12, choices=STATUSES, default="open")
    referred_date = models.DateField()
    baseline_wfa_z = models.FloatField(null=True, blank=True)
    baseline_hfa_z = models.FloatField(null=True, blank=True)
    baseline_wfh_z = models.FloatField(null=True, blank=True)
    baseline_bmi_z = models.FloatField(null=True, blank=True)
    referred_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-referred_date", "-id"]

    def __str__(self):
        return f"{self.child.name} -> {self.facility} ({self.status})"
