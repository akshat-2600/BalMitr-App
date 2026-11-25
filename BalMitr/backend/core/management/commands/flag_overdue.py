from datetime import date
from django.core.management.base import BaseCommand
from core.models import FollowUp


class Command(BaseCommand):
    help = "Flag pending follow-ups past their due date as overdue (no push notifications)."

    def handle(self, *args, **opts):
        today = date.today()
        updated = FollowUp.objects.filter(status="pending", due_date__lt=today).update(status="overdue")
        self.stdout.write(self.style.SUCCESS(f"Flagged {updated} overdue follow-up(s)."))
