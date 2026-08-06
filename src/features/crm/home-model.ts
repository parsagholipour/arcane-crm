export function quarterlyGoalOrFallback(value: unknown, fallback: number) {
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) return fallback;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}
