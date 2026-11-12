export function eventDateRangeError(startValue: unknown, endValue: unknown): string | null {
  const start = startValue instanceof Date ? startValue : new Date(String(startValue ?? ""));
  const end = endValue instanceof Date ? endValue : new Date(String(endValue ?? ""));
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return "Start and end dates must be valid dates";
  if (end < start) return "End date must be on or after start date";
  return null;
}
