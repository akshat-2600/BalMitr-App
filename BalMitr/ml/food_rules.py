"""Rule-based Indian food suggestion engine with age & choking safety rules (not ML)."""

DEMO_FOOD_NOTICE = "Demo list: needs review by a nutrition expert"


def determine_nutrient_needs(statuses: list[str]) -> list[str]:
    """Map WHO status labels to priority nutrient tags."""
    joined = " ".join(s.lower() for s in statuses if s)
    needs: list[str] = []
    if any(k in joined for k in ("underweight", "wasted", "thinness")):
        needs.extend(["energy", "protein"])
    if "stunted" in joined:
        needs.extend(["protein", "iron", "vitamin_a"])
    if any(k in joined for k in ("overweight", "obesity", "above normal")):
        needs.extend(["protein", "iron", "vitamin_a"])
    if not needs:
        needs = ["energy", "protein", "iron", "vitamin_a"]
    # Deduplicate preserving order
    return list(dict.fromkeys(needs))


def suggest_foods(
    foods: list[dict],
    age_months: int,
    statuses: list[str],
    limit: int = 8,
) -> dict:
    """Filter and rank age-safe Indian foods using written nutrition & safety rules."""
    needs = determine_nutrient_needs(statuses)
    safety_notes: list[str] = []

    if age_months < 6:
        safety_notes.append(
            "Under 6 months: exclusive breastfeeding is recommended; do not introduce solid foods yet."
        )
        return {
            "notice": DEMO_FOOD_NOTICE,
            "age_months": age_months,
            "needs": needs,
            "safety_notes": safety_notes,
            "suggestions": [],
        }

    if age_months < 12:
        safety_notes.append("No honey under 12 months (safety rule: infant botulism risk).")
    if age_months < 36:
        safety_notes.append("No whole nuts or hard chunks under 36 months (choking prevention).")
    if age_months < 9:
        safety_notes.append("Serve mashed or soft textures only for ages 6–8 months.")

    overweight_focus = any(
        k in " ".join(s.lower() for s in statuses)
        for k in ("overweight", "obesity")
    )

    safe_foods = []
    for f in foods:
        if f.get("min_age_months", 0) > age_months:
            continue
        if age_months < 12 and f.get("has_honey"):
            continue
        if age_months < 36 and f.get("is_whole_nut"):
            continue
        if age_months < 9 and f.get("texture") == "solid":
            continue

        score = 0
        for need in needs:
            if f.get(f"tag_{need}"):
                score += 2
        if overweight_focus and f.get("tag_energy") and not (f.get("tag_iron") or f.get("tag_vitamin_a")):
            score -= 1
        safe_foods.append((score, f))

    safe_foods.sort(key=lambda pair: (-pair[0], pair[1]["min_age_months"], pair[1]["name"]))
    return {
        "notice": DEMO_FOOD_NOTICE,
        "age_months": age_months,
        "needs": needs,
        "safety_notes": safety_notes,
        "suggestions": [item for _, item in safe_foods[:limit]],
    }
