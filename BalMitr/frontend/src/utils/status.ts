export function statusChipClass(label: string): string {
  const s = label.toLowerCase();
  if (s.includes("severely") || s.includes("severe") || s.includes("obesity")) {
    return "chip chip-red";
  }
  if (
    s.includes("underweight") ||
    s.includes("stunted") ||
    s.includes("wasted") ||
    s.includes("thinness") ||
    s.includes("overweight") ||
    s.includes("obese") ||
    s.includes("above normal")
  ) {
    return "chip chip-amber";
  }
  if (s === "normal") {
    return "chip chip-mint";
  }
  return "chip chip-neutral";
}

export function isAttentionStatus(chips: string[]): boolean {
  return chips.some((c) => {
    const s = c.toLowerCase();
    return s !== "normal" && !s.includes("not applicable") && s !== "tall";
  });
}

export function quickRiskFromChips(chips: string[]): "High" | "Moderate" | "Low" {
  if (chips.some((c) => c.toLowerCase().includes("sever"))) {
    return "High";
  }
  if (isAttentionStatus(chips)) {
    return "Moderate";
  }
  return "Low";
}
