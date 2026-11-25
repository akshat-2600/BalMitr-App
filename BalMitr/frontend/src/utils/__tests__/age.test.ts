import { describe, expect, it } from "vitest";
import { ageInMonths, formatAge, MAX_AGE_MONTHS } from "../age";

describe("age helpers", () => {
  it("formats months and years cleanly", () => {
    expect(MAX_AGE_MONTHS).toBe(144);
    expect(formatAge(8)).toBe("8 months");
    expect(formatAge(14)).toBe("14 months");
    expect(formatAge(1)).toBe("1 month");
    expect(formatAge(30)).toBe("2y 6m");
    expect(formatAge(111)).toBe("9y 3m");
  });

  it("computes completed months accurately", () => {
    expect(ageInMonths("2026-01-15", "2026-07-14")).toBe(5);
    expect(ageInMonths("2026-01-15", "2026-07-15")).toBe(6);
  });
});
