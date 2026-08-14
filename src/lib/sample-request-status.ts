/** Canonical Sample Status that still means the sample has not been shipped. */
export const SAMPLE_STATUS_NEED_SHIPPING = "Need shipping";

function normalizedSampleStatus(sampleStatus: string | null | undefined) {
  return String(sampleStatus ?? "")
    .trim()
    .toLowerCase();
}

/**
 * True when Sample Status is empty, "--None--", or "Need shipping". Any later status
 * (Shipped, Follow ups due, Converted, No interest) means it is already past shipping.
 */
export function sampleRequestNeedsShipping(sampleStatus: string | null | undefined) {
  const value = normalizedSampleStatus(sampleStatus);
  return value === "" || value === "none" || value === "--none--" || value === "need shipping";
}

export function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

/**
 * The requested calendar day has ended (UTC) and the sample is still unshipped.
 * A missing date is never due: there is nothing to be late against.
 */
export function sampleRequestReminderIsDue(
  sampleRequestedDate: Date | null | undefined,
  sampleStatus: string | null | undefined,
  now: Date
) {
  if (!sampleRequestedDate || !Number.isFinite(sampleRequestedDate.getTime())) return false;
  if (!sampleRequestNeedsShipping(sampleStatus)) return false;
  return startOfUtcDay(sampleRequestedDate) < startOfUtcDay(now);
}
