import { FORECAST_CATEGORIES, isValidEmail, LEAD_STATUSES, OPPORTUNITY_STAGES } from "@/lib/record-validation";

export const MAX_LEADS_PER_CONVERSION = 200;
const DEFAULT_ACCOUNT_NAME = "Converted Lead Account";
const CONVERSION_NEXT_STEP = "Follow up after lead conversion";

/** Probability seeded on the opportunity created by a conversion, by stage. */
const STAGE_PROBABILITY: Record<string, number> = {
  Qualify: 10,
  "Meet & Present": 25,
  Propose: 50,
  Negotiate: 75,
  "Closed Won": 100,
  "Closed Lost": 0
};

export class LeadConversionValidationError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 409 = 400,
    readonly field?: string
  ) {
    super(message);
    this.name = "LeadConversionValidationError";
  }
}

/** The lead fields conversion reads. Structural so tests need no database. */
export type ConvertibleLead = {
  id: string;
  salutation?: string | null;
  firstName?: string | null;
  lastName: string;
  company?: string | null;
  title?: string | null;
  website?: string | null;
  description?: string | null;
  ownerId: string;
  rating?: string | null;
  phone?: string | null;
  email?: string | null;
  country?: string | null;
  street?: string | null;
  postalCode?: string | null;
  city?: string | null;
  state?: string | null;
  numberOfEmployees?: number | null;
  annualRevenue?: unknown;
  leadSource?: string | null;
  industry?: string | null;
};

export type ContactOverrides = {
  salutation?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  title?: string | null;
  phone?: string | null;
  email?: string | null;
};

export type NormalizedConversion = {
  singleLead: boolean;
  convertedStatus: string;
  createOpportunity: boolean;
  stage: string;
  forecastCategory: string;
  closeDate: Date;
  amount: string | null;
  accountName: string;
  opportunityName: string;
  existingAccountId: string;
  existingContactId: string;
  existingOpportunityId: string;
  contactOverrides: ContactOverrides;
};

export function daysFromNow(days: number, now = new Date()) {
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  return date;
}

/**
 * Coerce and validate the raw workflow `values` bag. Overrides that name a single
 * target record are only honoured for single-lead conversions; a bulk conversion
 * derives every account/contact/opportunity from its own lead.
 */
export function normalizeConversionValues(
  values: Record<string, unknown>,
  leadCount: number,
  now = new Date()
): NormalizedConversion {
  if (leadCount > MAX_LEADS_PER_CONVERSION) {
    throw new LeadConversionValidationError(
      `Convert at most ${MAX_LEADS_PER_CONVERSION} leads at a time.`,
      400,
      "selectedIds"
    );
  }

  const singleLead = leadCount === 1;
  const createOpportunity = values.createOpportunity !== false;

  const convertedStatus = String(values.convertedStatus ?? "Qualified");
  if (!LEAD_STATUSES.has(convertedStatus)) {
    throw new LeadConversionValidationError("Choose a valid Lead Status.", 400, "convertedStatus");
  }

  let stage = "Qualify";
  let forecastCategory = "Pipeline";
  let closeDate = daysFromNow(30, now);
  let amount: string | null = null;

  if (createOpportunity) {
    stage = String(values.stage ?? "Qualify");
    if (!OPPORTUNITY_STAGES.has(stage)) {
      throw new LeadConversionValidationError("Choose a valid Stage.", 400, "stage");
    }
    forecastCategory = String(values.forecastCategory ?? "Pipeline");
    if (!FORECAST_CATEGORIES.has(forecastCategory)) {
      throw new LeadConversionValidationError("Choose a valid Forecast Category.", 400, "forecastCategory");
    }
    if (values.closeDate !== undefined && values.closeDate !== null && String(values.closeDate).trim() !== "") {
      closeDate = new Date(String(values.closeDate));
      if (!Number.isFinite(closeDate.getTime())) {
        throw new LeadConversionValidationError("Choose a valid Close Date.", 400, "closeDate");
      }
    }
    amount = normalizeAmount(values.amount);
  }

  const contactOverrides = singleLead ? normalizeContactOverrides(values.contact) : {};

  return {
    singleLead,
    convertedStatus,
    createOpportunity,
    stage,
    forecastCategory,
    closeDate,
    amount,
    accountName: singleLead ? String(values.accountName ?? "").trim() : "",
    opportunityName: singleLead ? String(values.opportunityName ?? "").trim() : "",
    existingAccountId: singleLead ? String(values.existingAccountId ?? "").trim() : "",
    existingContactId: singleLead ? String(values.existingContactId ?? "").trim() : "",
    existingOpportunityId: singleLead && createOpportunity ? String(values.existingOpportunityId ?? "").trim() : "",
    contactOverrides
  };
}

function normalizeAmount(value: unknown): string | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new LeadConversionValidationError("Amount must be a non-negative number.", 400, "amount");
  }
  return String(value).trim();
}

function normalizeContactOverrides(value: unknown): ContactOverrides {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const overrides: ContactOverrides = {};

  for (const field of ["salutation", "firstName", "title", "phone"] as const) {
    if (source[field] !== undefined) overrides[field] = blankToNull(source[field]);
  }

  if (source.lastName !== undefined) {
    const lastName = String(source.lastName ?? "").trim();
    if (!lastName) throw new LeadConversionValidationError("Last Name is required.", 400, "contact.lastName");
    overrides.lastName = lastName;
  }

  if (source.email !== undefined) {
    const email = String(source.email ?? "").trim();
    if (email && !isValidEmail(email)) {
      throw new LeadConversionValidationError("Enter a valid email address.", 400, "contact.email");
    }
    overrides.email = email || null;
  }

  return overrides;
}

function blankToNull(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text === "" || text === "--None--" ? null : text;
}

function decimalString(value: unknown): string | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  return String(value);
}

/** Override → the lead's own company → the person's name → a generic fallback. */
export function accountNameForLead(lead: ConvertibleLead, override?: string) {
  const explicit = String(override ?? "").trim();
  if (explicit) return explicit;
  const company = String(lead.company ?? "").trim();
  if (company) return company;
  const person = [lead.firstName, lead.lastName].filter(Boolean).join(" ").trim();
  return person || DEFAULT_ACCOUNT_NAME;
}

export function opportunityNameFor(accountName: string, override?: string) {
  const explicit = String(override ?? "").trim();
  return explicit || `${accountName} Opportunity`;
}

export function probabilityForStage(stage: string): number | null {
  return stage in STAGE_PROBABILITY ? STAGE_PROBABILITY[stage] : null;
}

export function buildAccountData(lead: ConvertibleLead, accountName: string) {
  return {
    name: accountName,
    website: lead.website ?? null,
    type: "Prospect",
    ownerId: lead.ownerId,
    phone: lead.phone ?? null,
    rating: lead.rating ?? null,
    numberOfEmployees: lead.numberOfEmployees ?? null,
    annualRevenue: decimalString(lead.annualRevenue),
    industry: lead.industry ?? null,
    billingCountry: lead.country ?? null,
    billingStreet: lead.street ?? null,
    billingPostalCode: lead.postalCode ?? null,
    billingCity: lead.city ?? null,
    billingState: lead.state ?? null
  };
}

export function buildContactData(lead: ConvertibleLead, accountId: string, overrides: ContactOverrides = {}) {
  return {
    salutation: override(overrides.salutation, lead.salutation),
    firstName: override(overrides.firstName, lead.firstName),
    lastName: String(overrides.lastName ?? "").trim() || lead.lastName,
    accountId,
    title: override(overrides.title, lead.title),
    description: lead.description ?? null,
    ownerId: lead.ownerId,
    phone: override(overrides.phone, lead.phone),
    email: override(overrides.email, lead.email),
    leadSource: lead.leadSource ?? null,
    mailingCountry: lead.country ?? null,
    mailingStreet: lead.street ?? null,
    mailingPostalCode: lead.postalCode ?? null,
    mailingCity: lead.city ?? null,
    mailingState: lead.state ?? null
  };
}

function override(value: string | null | undefined, fallback: string | null | undefined) {
  return value === undefined ? (fallback ?? null) : value;
}

/**
 * Re-parent an existing contact onto the converted account, filling only the
 * fields it is currently missing so the conversion never overwrites better data.
 */
export function buildContactMergeData(
  existing: { title?: string | null; phone?: string | null; email?: string | null; leadSource?: string | null },
  lead: ConvertibleLead,
  accountId: string
) {
  return {
    accountId,
    title: existing.title ?? lead.title ?? null,
    phone: existing.phone ?? lead.phone ?? null,
    email: existing.email ?? lead.email ?? null,
    leadSource: existing.leadSource ?? lead.leadSource ?? null
  };
}

export function buildOpportunityData(
  lead: ConvertibleLead,
  accountId: string,
  contactId: string,
  options: { name: string; closeDate: Date; stage: string; forecastCategory: string; amount: string | null }
) {
  return {
    name: options.name,
    accountId,
    contactId,
    closeDate: options.closeDate,
    amount: options.amount,
    description: lead.description ?? null,
    ownerId: lead.ownerId,
    stage: options.stage,
    probability: probabilityForStage(options.stage),
    forecastCategory: options.forecastCategory,
    nextStep: CONVERSION_NEXT_STEP,
    leadSource: lead.leadSource ?? null
  };
}

export function normalizeName(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export function normalizePhone(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

/**
 * Comparison key for duplicate detection. Compares the trailing national digits so
 * "+1 (415) 555-0100" and "415-555-0100" match, and ignores fragments too short to
 * be a real number.
 */
export function phoneMatchKey(value: unknown) {
  const digits = normalizePhone(value);
  return digits.length >= 7 ? digits.slice(-10) : "";
}

type NamedAccount = { id: string; name?: string | null };
type NamedContact = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
};

/** Case-insensitive account suggestions for a lead, exact matches ranked first. */
export function matchAccountsForLead<T extends NamedAccount>(accounts: T[], lead: ConvertibleLead, limit = 3) {
  const target = normalizeName(lead.company);
  if (!target) return [];
  const exact: T[] = [];
  const partial: T[] = [];
  for (const account of accounts) {
    const name = normalizeName(account.name);
    if (!name) continue;
    if (name === target) exact.push(account);
    else if (name.includes(target) || target.includes(name)) partial.push(account);
  }
  return [...exact, ...partial].slice(0, limit);
}

export function findExactAccountMatch<T extends NamedAccount>(accounts: T[], accountName: string) {
  const target = normalizeName(accountName);
  if (!target) return undefined;
  return accounts.find((account) => normalizeName(account.name) === target);
}

/** Contact suggestions ranked email > phone > full name. */
export function matchContactsForLead<T extends NamedContact>(contacts: T[], lead: ConvertibleLead, limit = 3) {
  const email = normalizeName(lead.email);
  const phone = phoneMatchKey(lead.phone);
  const fullName = normalizeName([lead.firstName, lead.lastName].filter(Boolean).join(" "));
  const scored: { contact: T; score: number }[] = [];

  for (const contact of contacts) {
    const contactName = normalizeName([contact.firstName, contact.lastName].filter(Boolean).join(" "));
    if (email && normalizeName(contact.email) === email) scored.push({ contact, score: 3 });
    else if (phone && phoneMatchKey(contact.phone) === phone) scored.push({ contact, score: 2 });
    else if (fullName && contactName === fullName) scored.push({ contact, score: 1 });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.contact);
}

/**
 * Split rows being re-parented onto a target that already has rows under a
 * unique constraint. Rows whose key is already taken must be dropped rather than
 * moved, otherwise the update violates the constraint.
 */
export function splitCollidingRows<T extends { id: string }>(
  rows: T[],
  keyOf: (row: T) => string,
  takenKeys: Iterable<string>
) {
  const taken = new Set(takenKeys);
  const moveIds: string[] = [];
  const dropIds: string[] = [];
  for (const row of rows) {
    const key = keyOf(row);
    if (taken.has(key)) {
      dropIds.push(row.id);
    } else {
      taken.add(key);
      moveIds.push(row.id);
    }
  }
  return { moveIds, dropIds };
}
