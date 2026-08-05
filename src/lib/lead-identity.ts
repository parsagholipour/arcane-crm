/** At least one of these must be present when creating a Lead. */
export const LEAD_IDENTITY_FIELDS = ["firstName", "lastName", "company", "title"] as const;

export type LeadIdentityField = (typeof LEAD_IDENTITY_FIELDS)[number];

export const LEAD_IDENTITY_ERROR = "Enter a First Name, Last Name, Company, or Title.";

export function isBlankLeadIdentityValue(value: unknown) {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" || trimmed === "--None--";
  }
  return false;
}

export function leadHasIdentity(values: Record<string, unknown>) {
  return LEAD_IDENTITY_FIELDS.some((field) => !isBlankLeadIdentityValue(values[field]));
}

/** Field-level errors for the New/Edit Lead form when identity is missing. */
export function leadIdentityFieldErrors(values: Record<string, unknown>): Record<string, string> {
  if (leadHasIdentity(values)) return {};
  return Object.fromEntries(LEAD_IDENTITY_FIELDS.map((field) => [field, LEAD_IDENTITY_ERROR]));
}
