from datetime import date
import uuid

from django.conf import settings
from django.db import connection
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from ml import food_rules, growth, trends
from .models import Centre, Child, FollowUp, FoodItem, HomeVisit, Measurement, Referral
from .serializers import (
    CentreSerializer,
    ChildSerializer,
    FollowUpSerializer,
    HomeVisitSerializer,
    LoginSerializer,
    MeasurementSerializer,
    ReferralSerializer,
)
from .services import recalculate_child_risk


class HasProfile(permissions.IsAuthenticated):
    def has_permission(self, request, view):
        return super().has_permission(request, view) and hasattr(request.user, "profile")


class IsSupervisorOrReadOnly(HasProfile):
    def has_permission(self, request, view):
        ok = super().has_permission(request, view)
        if request.method in permissions.SAFE_METHODS:
            return ok
        return ok and request.user.profile.role == "supervisor"


def limit_to_centre(qs, user, field="centre_id"):
    p = user.profile
    return qs if p.role == "supervisor" else qs.filter(**{field: p.centre_id})


class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer


class MeView(APIView):
    permission_classes = [HasProfile]

    @extend_schema(responses=None)
    def get(self, request):
        p = request.user.profile
        return Response({
            "username": request.user.username,
            "full_name": p.full_name or request.user.get_full_name() or request.user.username,
            "role": p.role,
            "centre_id": p.centre_id,
            "centre_name": p.centre.name if p.centre else None,
        })


class HealthView(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(responses=None)
    def get(self, request):
        return Response({
            "status": "ok",
            "version": settings.BALMITR_API_VERSION,
            "max_age_months": settings.BALMITR_MAX_AGE_MONTHS,
            "database_engine": connection.vendor,
            "counts": {
                "centres": Centre.objects.count(),
                "children": Child.objects.count(),
                "measurements": Measurement.objects.count(),
            },
        })


class CentreViewSet(viewsets.ModelViewSet):
    queryset = Centre.objects.all().order_by("name")
    serializer_class = CentreSerializer
    permission_classes = [IsSupervisorOrReadOnly]


class ChildViewSet(viewsets.ModelViewSet):
    serializer_class = ChildSerializer
    permission_classes = [HasProfile]

    def get_queryset(self):
        return limit_to_centre(
            Child.objects.select_related("centre", "risk").prefetch_related("measurements").order_by("name"),
            self.request.user,
        )

    def perform_create(self, serializer):
        serializer.save(registered_by=self.request.user)

    @extend_schema(responses=None)
    @action(detail=True, methods=["get"], url_path="growth-history")
    def growth_history(self, request, pk=None):
        child = self.get_object()
        qs = child.measurements.order_by("date", "id")
        items = MeasurementSerializer(qs, many=True).data
        age_months = growth.age_in_months(child.date_of_birth)
        return Response({
            "child": ChildSerializer(child).data,
            "measurements": items,
            "trends": trends.analyze_trends(items),
            "charts": trends.build_growth_curves(child.sex, age_months),
        })

    @extend_schema(responses=None)
    @action(detail=True, methods=["get"], url_path="food-suggestions")
    def food_suggestions(self, request, pk=None):
        child = self.get_object()
        age_months = growth.age_in_months(child.date_of_birth)
        chips = ChildSerializer(child).data["status_chips"]
        foods = list(FoodItem.objects.values())
        return Response(food_rules.suggest_foods(foods, age_months, chips))


class MeasurementViewSet(viewsets.ModelViewSet):
    serializer_class = MeasurementSerializer
    permission_classes = [HasProfile]
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        qs = limit_to_centre(
            Measurement.objects.select_related("child").all(),
            self.request.user,
            "child__centre_id",
        )
        child = self.request.query_params.get("child")
        return qs.filter(child_id=child) if child else qs


class AlertsView(APIView):
    """Children needing attention (High / Moderate risk), sorted High first."""
    permission_classes = [HasProfile]

    @extend_schema(responses=None)
    def get(self, request):
        qs = limit_to_centre(
            Child.objects.select_related("centre", "risk").prefetch_related("measurements").filter(
                risk__level__in=["High", "Moderate"]
            ),
            request.user,
        )
        children = sorted(
            qs,
            key=lambda c: (0 if c.risk.level == "High" else 1, c.name),
        )
        return Response(ChildSerializer(children, many=True).data)


class FollowUpViewSet(viewsets.ModelViewSet):
    serializer_class = FollowUpSerializer
    permission_classes = [HasProfile]

    def get_queryset(self):
        qs = limit_to_centre(
            FollowUp.objects.select_related("child", "child__centre").all(),
            self.request.user,
            "child__centre_id",
        )
        child = self.request.query_params.get("child")
        if child:
            qs = qs.filter(child_id=child)
        bucket = self.request.query_params.get("bucket")
        today = date.today()
        if bucket == "due_today":
            qs = qs.filter(due_date=today).exclude(status="done")
        elif bucket == "overdue":
            qs = qs.filter(status="overdue")
        elif bucket == "done":
            qs = qs.filter(status="done")
        elif bucket == "upcoming":
            qs = qs.filter(status="pending", due_date__gt=today)
        return qs


class HomeVisitViewSet(viewsets.ModelViewSet):
    serializer_class = HomeVisitSerializer
    permission_classes = [HasProfile]
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        qs = limit_to_centre(
            HomeVisit.objects.select_related("child").all(),
            self.request.user,
            "child__centre_id",
        )
        child = self.request.query_params.get("child")
        return qs.filter(child_id=child) if child else qs


class ReferralViewSet(viewsets.ModelViewSet):
    serializer_class = ReferralSerializer
    permission_classes = [HasProfile]

    def get_queryset(self):
        qs = limit_to_centre(
            Referral.objects.select_related("child", "child__centre").all(),
            self.request.user,
            "child__centre_id",
        )
        child = self.request.query_params.get("child")
        return qs.filter(child_id=child) if child else qs


class GrowthAssessView(APIView):
    """Stateless WHO calculator preview (does not save to DB)."""
    permission_classes = [HasProfile]

    @extend_schema(
        parameters=[
            OpenApiParameter("sex", str, description="M or F"),
            OpenApiParameter("dob", str, description="YYYY-MM-DD"),
            OpenApiParameter("weight", float, description="kg"),
            OpenApiParameter("height", float, description="cm"),
            OpenApiParameter("date", str, required=False, description="YYYY-MM-DD"),
            OpenApiParameter("position", str, required=False, description="lying or standing"),
        ],
        responses=None,
    )
    def get(self, request):
        try:
            sex = request.query_params["sex"].upper()
            dob = date.fromisoformat(request.query_params["dob"])
            weight = float(request.query_params["weight"])
            height = float(request.query_params["height"])
            on_str = request.query_params.get("date")
            on = date.fromisoformat(on_str) if on_str else date.today()
            pos = request.query_params.get("position")
            return Response(growth.assess(sex, dob, weight, height, on=on, measured_position=pos))
        except (KeyError, ValueError) as e:
            return Response(
                {"error": {"code": "validation_error", "message": str(e), "details": {"detail": str(e)}}},
                status=400,
            )


class SummaryView(APIView):
    """Read-only counts by WHO status and risk per centre."""
    permission_classes = [HasProfile]

    @extend_schema(responses=None)
    def get(self, request):
        centres = Centre.objects.all().order_by("name")
        if request.user.profile.role == "worker":
            centres = centres.filter(id=request.user.profile.centre_id)

        month_prefix = date.today().isoformat()[:7]
        out = []
        for ctr in centres:
            kids = list(
                Child.objects.filter(centre=ctr).select_related("risk").prefetch_related("measurements")
            )
            risk_counts = {"High": 0, "Moderate": 0, "Low": 0}
            status_counts: dict[str, int] = {}
            measured_month = 0
            for k in kids:
                lvl = k.risk.level if hasattr(k, "risk") and k.risk else "Low"
                risk_counts[lvl] = risk_counts.get(lvl, 0) + 1
                m = k.measurements.first()
                if m:
                    if m.date.isoformat().startswith(month_prefix):
                        measured_month += 1
                    for label in (m.status, m.height_status, m.wfh_status, m.bmi_status):
                        if label and label != "Not applicable for this age":
                            status_counts[label] = status_counts.get(label, 0) + 1
            out.append({
                "centre_id": ctr.id,
                "centre_name": ctr.name,
                "code": ctr.code,
                "total_children": len(kids),
                "measured_this_month": measured_month,
                "risk_counts": risk_counts,
                "status_counts": status_counts,
            })
        return Response({"centres": out})


class SyncView(APIView):
    """Idempotent batch sync for offline children and measurements. Server values win."""
    permission_classes = [HasProfile]

    @extend_schema(responses=None)
    def post(self, request):
        items = request.data.get("items")
        if not isinstance(items, list):
            raise ValidationError({"items": "Provide a list of sync items."})

        results = []
        counts = {"synced": 0, "already_synced": 0, "failed": 0}

        for item in items:
            raw_uuid = item.get("client_uuid")
            item_type = item.get("type")
            payload = dict(item.get("payload") or {})
            try:
                cuuid = uuid.UUID(str(raw_uuid))
            except Exception:
                counts["failed"] += 1
                results.append({"client_uuid": raw_uuid, "status": "failed", "error": "Invalid client_uuid."})
                continue

            if item_type == "child":
                existing = Child.objects.filter(client_uuid=cuuid).first()
                if existing:
                    counts["already_synced"] += 1
                    results.append({
                        "client_uuid": str(cuuid),
                        "status": "already_synced",
                        "server_id": existing.id,
                        "data": ChildSerializer(existing).data,
                    })
                    continue
                if request.user.profile.role == "worker" and not payload.get("centre"):
                    payload["centre"] = request.user.profile.centre_id
                ser = ChildSerializer(data=payload, context={"request": request})
                if not ser.is_valid():
                    counts["failed"] += 1
                    results.append({"client_uuid": str(cuuid), "status": "failed", "error": ser.errors})
                    continue
                obj = ser.save(registered_by=request.user, client_uuid=cuuid)
                recalculate_child_risk(obj)
                counts["synced"] += 1
                results.append({
                    "client_uuid": str(cuuid),
                    "status": "synced",
                    "server_id": obj.id,
                    "data": ChildSerializer(obj).data,
                })

            elif item_type == "measurement":
                existing = Measurement.objects.filter(client_uuid=cuuid).first()
                if existing:
                    counts["already_synced"] += 1
                    results.append({
                        "client_uuid": str(cuuid),
                        "status": "already_synced",
                        "server_id": existing.id,
                        "data": MeasurementSerializer(existing).data,
                    })
                    continue
                if not payload.get("child") and payload.get("child_client_uuid"):
                    linked = Child.objects.filter(client_uuid=payload["child_client_uuid"]).first()
                    if linked:
                        payload["child"] = linked.id
                ser = MeasurementSerializer(data=payload, context={"request": request})
                if not ser.is_valid():
                    counts["failed"] += 1
                    results.append({"client_uuid": str(cuuid), "status": "failed", "error": ser.errors})
                    continue
                obj = ser.save(client_uuid=cuuid)
                counts["synced"] += 1
                results.append({
                    "client_uuid": str(cuuid),
                    "status": "synced",
                    "server_id": obj.id,
                    "data": MeasurementSerializer(obj).data,
                })
            else:
                counts["failed"] += 1
                results.append({"client_uuid": str(cuuid), "status": "failed", "error": f"Unknown type '{item_type}'."})

        return Response({"results": results, "summary": counts})
