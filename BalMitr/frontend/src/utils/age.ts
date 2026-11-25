export const MAX_AGE_MONTHS = 144;

export function ageInMonths(dobIso: string, onIso?: string): number {
  const [y1, m1, d1] = dobIso.split("-").map(Number);
  const now = onIso ? onIso.split("-").map(Number) : null;
  const today = now
    ? new Date(now[0], now[1] - 1, now[2])
    : new Date();
  let months = (today.getFullYear() - y1) * 12 + (today.getMonth() + 1 - m1);
  if (today.getDate() < d1) {
    months -= 1;
  }
  return months;
}

export function formatAge(months: number): string {
  if (months < 0) return "0 months";
  if (months < 24) {
    return months === 1 ? "1 month" : `${months} months`;
  }
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return `${years}y ${rem}m`;
}
