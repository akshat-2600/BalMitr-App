import json
from pathlib import Path
from django.core.management.base import BaseCommand
from core.models import FoodItem


class Command(BaseCommand):
    help = "Import the demo Indian food list from ml/foods.json (needs review by a nutrition expert)."

    def handle(self, *args, **opts):
        foods_path = Path(__file__).resolve().parents[4] / "ml" / "foods.json"
        data = json.loads(foods_path.read_text(encoding="utf-8"))
        for row in data:
            FoodItem.objects.update_or_create(name=row["name"], defaults=row)
        self.stdout.write(
            self.style.SUCCESS(
                f"Imported {len(data)} foods (demo list: needs review by a nutrition expert)."
            )
        )
