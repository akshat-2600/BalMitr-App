from django.contrib import admin
from .models import (
    Centre,
    Child,
    FollowUp,
    FoodItem,
    HomeVisit,
    Measurement,
    Profile,
    Referral,
    RiskAssessment,
)

admin.site.register(Centre)
admin.site.register(Profile)
admin.site.register(Child)
admin.site.register(Measurement)
admin.site.register(FoodItem)
admin.site.register(RiskAssessment)
admin.site.register(FollowUp)
admin.site.register(HomeVisit)
admin.site.register(Referral)
