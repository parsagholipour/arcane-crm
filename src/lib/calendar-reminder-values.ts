export const DEFAULT_EVENT_REMINDER_MINUTES = 24 * 60;
export const MAX_EVENT_REMINDER_MINUTES = 4 * 7 * 24 * 60;

export const EVENT_REMINDER_OPTIONS = [
  { label: "None", value: "" },
  { label: "5 minutes before", value: "5" },
  { label: "10 minutes before", value: "10" },
  { label: "15 minutes before", value: "15" },
  { label: "30 minutes before", value: "30" },
  { label: "1 hour before", value: "60" },
  { label: "1 day before", value: String(DEFAULT_EVENT_REMINDER_MINUTES) }
] as const;

export function formatReminderOffset(value: unknown) {
  const minutes = Number(value);
  if (!Number.isInteger(minutes) || minutes < 0) return "";
  if (minutes === 0) return "At start time";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} before`;
  if (minutes % (7 * 24 * 60) === 0) {
    const weeks = minutes / (7 * 24 * 60);
    return `${weeks} week${weeks === 1 ? "" : "s"} before`;
  }
  if (minutes % (24 * 60) === 0) {
    const days = minutes / (24 * 60);
    return `${days} day${days === 1 ? "" : "s"} before`;
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} hour${hours === 1 ? "" : "s"} before`;
  }
  return `${minutes} minutes before`;
}
