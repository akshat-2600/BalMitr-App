from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

router = DefaultRouter()
router.register("centres", views.CentreViewSet, basename="centre")
router.register("children", views.ChildViewSet, basename="child")
router.register("measurements", views.MeasurementViewSet, basename="measurement")
router.register("follow-ups", views.FollowUpViewSet, basename="followup")
router.register("visits", views.HomeVisitViewSet, basename="visit")
router.register("referrals", views.ReferralViewSet, basename="referral")

urlpatterns = [
    path("auth/login/", views.LoginView.as_view()),
    path("auth/refresh/", TokenRefreshView.as_view()),
    path("me/", views.MeView.as_view()),
    path("health/", views.HealthView.as_view()),
    path("alerts/", views.AlertsView.as_view()),
    path("summary/", views.SummaryView.as_view()),
    path("sync/", views.SyncView.as_view()),
    path("growth/assess/", views.GrowthAssessView.as_view()),
    path("", include(router.urls)),
]
