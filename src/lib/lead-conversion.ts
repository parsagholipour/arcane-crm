import { FORECAST_CATEGORIES, isValidEmail, LEAD_STATUSES, OPPORTUNITY_STAGES } from "@/lib/record-validation";
import { COURIERS, isLikelyUspsTrackingNumber, isUspsCarrier } from "@/lib/usps-status";
import { LEAD_SOURCE } from "@/lib/crm-metadata/options";

export const MAX_LEADS_PER_CONVERSION = 200;
const DEFAULT_ACCOUNT_NAME = "Converted Lead Account";
/** Shared convert Opportunity seed — keep UI and normalizeConversionValues aligned. */
export const CONVERSION_OPPORTUNITY_STAGE = "Qualify";
export const CONVERSION_OPPORTUNITY_FORECAST = "Pipeline";
export const CONVERSION_NEXT_STEP = "Follow up after lead conversion";
export const CONVERSION_CLOSE_DATE_OFFSET_DAYS = 30;
const LEAD_SOURCES = new Set(LEAD_SOURCE.filter((value) => value !== "--None--"));
const COURIER_CHOICES = new Set<string>(COURIERS);

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
  lastName?: string | null;
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
  description?: string | null;
  ownerId?: string | null;
  birthDate?: string | null;
  leadSource?: string | null;
  reportsToContactId?: string | null;
  mailingCountry?: string | null;
  mailingStreet?: string | null;
  mailingPostalCode?: string | null;
  mailingCity?: string | null;
  mailingState?: string | null;
};

/** Account fields the convert UI can override; unset keys fall back to the lead mapping. */
export type AccountOverrides = {
  type?: string | null;
  description?: string | null;
  parentAccountId?: string | null;
  website?: string | null;
  ownerId?: string | null;
  phone?: string | null;
  numberOfEmployees?: number | null;
  annualRevenue?: string | null;
  industry?: string | null;
  rating?: string | null;
  billingCountry?: string | null;
  billingStreet?: string | null;
  billingPostalCode?: string | null;
  billingCity?: string | null;
  billingState?: string | null;
  shippingCountry?: string | null;
  shippingStreet?: string | null;
  shippingPostalCode?: string | null;
  shippingCity?: string | null;
  shippingState?: string | null;
};

export type NormalizedConversion = {
  singleLead: boolean;
  convertedStatus: string;
  createOpportunity: boolean;
  stage: string;
  forecastCategory: string;
  closeDate: Date;
  amount: string | null;
  description?: string | null;
  ownerId: string;
  probability: number | null;
  nextStep?: string | null;
  leadSource?: string | null;
  courier: string | null;
  trackingNumber: string | null;
  accountName: string;
  opportunityName: string;
  existingAccountId: string;
  existingContactId: string;
  existingOpportunityId: string;
  accountOverrides: AccountOverrides;
  contactOverrides: ContactOverrides;
};

export function daysFromNow(days: number, now = new Date()) {
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  return date;
}

/** Defaults for a new Opportunity created during lead conversion. */
export function defaultOpportunitySeed(now = new Date()) {
  const stage = CONVERSION_OPPORTUNITY_STAGE;
  return {
    stage,
    forecastCategory: CONVERSION_OPPORTUNITY_FORECAST,
    closeDate: daysFromNow(CONVERSION_CLOSE_DATE_OFFSET_DAYS, now),
    probability: probabilityForStage(stage),
    nextStep: CONVERSION_NEXT_STEP
  };
}

export function probabilityForStage(stage: string): number | null {
  return stage in STAGE_PROBABILITY ? STAGE_PROBABILITY[stage] : null;
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
  // Match convert UI: only create an Opportunity when explicitly requested.
  const createOpportunity = values.createOpportunity === true;

  const convertedStatus = String(values.convertedStatus ?? "Qualified");
  if (!LEAD_STATUSES.has(convertedStatus)) {
    throw new LeadConversionValidationError("Choose a valid Lead Status.", 400, "convertedStatus");
  }

  const opportunitySeed = defaultOpportunitySeed(now);
  let stage = opportunitySeed.stage;
  let forecastCategory = opportunitySeed.forecastCategory;
  let closeDate = opportunitySeed.closeDate;
  let amount: string | null = null;
  let description: string | null | undefined = undefined;
  let ownerId = "";
  let probability: number | null = null;
  let nextStep: string | null | undefined = undefined;
  let leadSource: string | null | undefined = undefined;
  let courier: string | null = null;
  let trackingNumber: string | null = null;

  if (createOpportunity) {
    stage = String(values.stage ?? opportunitySeed.stage);
    if (!OPPORTUNITY_STAGES.has(stage)) {
      throw new LeadConversionValidationError("Choose a valid Stage.", 400, "stage");
    }
    forecastCategory = String(values.forecastCategory ?? opportunitySeed.forecastCategory);
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
    if (singleLead) {
      if ("description" in values) description = optionalText(values.description);
      ownerId = String(values.ownerId ?? "").trim();
      if ("probability" in values) probability = normalizeProbability(values.probability);
      if ("nextStep" in values) nextStep = optionalText(values.nextStep);
      if ("leadSource" in values) {
        leadSource = optionalChoice(values.leadSource, LEAD_SOURCES, "Choose a valid Lead Source.", "leadSource");
      }
      if ("courier" in values) {
        courier = optionalChoice(values.courier, COURIER_CHOICES, "Choose a valid Courier.", "courier");
      }
      if ("trackingNumber" in values) trackingNumber = optionalText(values.trackingNumber);
      if (isUspsCarrier(courier) && trackingNumber && !isLikelyUspsTrackingNumber(trackingNumber)) {
        throw new LeadConversionValidationError(
          "Enter a valid USPS tracking number (20-22 digits, or two letters, nine digits, and US).",
          400,
          "trackingNumber"
        );
      }
    }
  }

  const contactOverrides = singleLead ? normalizeContactOverrides(values.contact) : {};
  const accountOverrides = singleLead ? normalizeAccountOverrides(values.account) : {};

  return {
    singleLead,
    convertedStatus,
    createOpportunity,
    stage,
    forecastCategory,
    closeDate,
    amount,
    description,
    ownerId,
    probability,
    nextStep,
    leadSource,
    courier,
    trackingNumber,
    accountName: singleLead ? String(values.accountName ?? "").trim() : "",
    opportunityName: singleLead ? String(values.opportunityName ?? "").trim() : "",
    existingAccountId: singleLead ? String(values.existingAccountId ?? "").trim() : "",
    existingContactId: singleLead ? String(values.existingContactId ?? "").trim() : "",
    existingOpportunityId: singleLead && createOpportunity ? String(values.existingOpportunityId ?? "").trim() : "",
    accountOverrides,
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

function normalizeProbability(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const probability = Number(value);
  if (!Number.isInteger(probability) || probability < 0 || probability > 100) {
    throw new LeadConversionValidationError(
      "Probability must be a whole number from 0 through 100.",
      400,
      "probability"
    );
  }
  return probability;
}

function optionalText(value: unknown): string | null {
  return blankToNull(value);
}

function optionalChoice(value: unknown, choices: Set<string>, message: string, field: string): string | null {
  const text = blankToNull(value);
  if (text === null) return null;
  if (!choices.has(text)) throw new LeadConversionValidationError(message, 400, field);
  return text;
}

function normalizeContactOverrides(value: unknown): ContactOverrides {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const overrides: ContactOverrides = {};

  for (const field of [
    "salutation",
    "firstName",
    "title",
    "phone",
    "description",
    "ownerId",
    "mailingCountry",
    "mailingStreet",
    "mailingPostalCode",
    "mailingCity",
    "mailingState",
    "reportsToContactId"
  ] as const) {
    if (source[field] !== undefined) overrides[field] = blankToNull(source[field]);
  }

  if (source.birthDate !== undefined) {
    const raw = blankToNull(source.birthDate);
    if (raw === null) overrides.birthDate = null;
    else {
      const date = new Date(raw);
      if (!Number.isFinite(date.getTime())) {
        throw new LeadConversionValidationError("Choose a valid birthdate.", 400, "contact.birthDate");
      }
      overrides.birthDate = raw;
    }
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

  if (source.leadSource !== undefined) {
    overrides.leadSource = optionalChoice(
      source.leadSource,
      LEAD_SOURCES,
      "Choose a valid Lead Source.",
      "contact.leadSource"
    );
  }

  return overrides;
}

function normalizeAccountOverrides(value: unknown): AccountOverrides {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const overrides: AccountOverrides = {};

  for (const field of [
    "type",
    "description",
    "parentAccountId",
    "website",
    "ownerId",
    "phone",
    "industry",
    "rating",
    "billingCountry",
    "billingStreet",
    "billingPostalCode",
    "billingCity",
    "billingState",
    "shippingCountry",
    "shippingStreet",
    "shippingPostalCode",
    "shippingCity",
    "shippingState"
  ] as const) {
    if (source[field] !== undefined) overrides[field] = blankToNull(source[field]);
  }

  if (source.numberOfEmployees !== undefined) {
    const raw = String(source.numberOfEmployees ?? "").trim();
    if (!raw || raw === "--None--") overrides.numberOfEmployees = null;
    else {
      const employees = Number(raw);
      if (!Number.isFinite(employees) || !Number.isInteger(employees) || employees < 0) {
        throw new LeadConversionValidationError(
          "Enter a non-negative whole number of employees.",
          400,
          "account.numberOfEmployees"
        );
      }
      overrides.numberOfEmployees = employees;
    }
  }

  if (source.annualRevenue !== undefined) {
    const raw = String(source.annualRevenue ?? "").trim();
    if (!raw || raw === "--None--") overrides.annualRevenue = null;
    else {
      const revenue = Number(raw);
      if (!Number.isFinite(revenue) || revenue < 0) {
        throw new LeadConversionValidationError("Enter a non-negative annual revenue.", 400, "account.annualRevenue");
      }
      overrides.annualRevenue = raw;
    }
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

export function buildAccountData(lead: ConvertibleLead, accountName: string, overrides: AccountOverrides = {}) {
  return {
    name: accountName,
    website: override(overrides.website, lead.website),
    // Align with Account form default (--None-- → null); convert UI may still override.
    type: overrides.type !== undefined ? overrides.type : null,
    description: overrides.description !== undefined ? overrides.description : (lead.description ?? null),
    parentAccountId: overrides.parentAccountId !== undefined ? overrides.parentAccountId : null,
    ownerId: override(overrides.ownerId, lead.ownerId) || lead.ownerId,
    phone: override(overrides.phone, lead.phone),
    rating: override(overrides.rating, lead.rating),
    numberOfEmployees:
      overrides.numberOfEmployees !== undefined ? overrides.numberOfEmployees : (lead.numberOfEmployees ?? null),
    annualRevenue: overrides.annualRevenue !== undefined ? overrides.annualRevenue : decimalString(lead.annualRevenue),
    industry: override(overrides.industry, lead.industry),
    billingCountry: override(overrides.billingCountry, lead.country),
    billingStreet: override(overrides.billingStreet, lead.street),
    billingPostalCode: override(overrides.billingPostalCode, lead.postalCode),
    billingCity: override(overrides.billingCity, lead.city),
    billingState: override(overrides.billingState, lead.state),
    shippingCountry: overrides.shippingCountry !== undefined ? overrides.shippingCountry : null,
    shippingStreet: overrides.shippingStreet !== undefined ? overrides.shippingStreet : null,
    shippingPostalCode: overrides.shippingPostalCode !== undefined ? overrides.shippingPostalCode : null,
    shippingCity: overrides.shippingCity !== undefined ? overrides.shippingCity : null,
    shippingState: overrides.shippingState !== undefined ? overrides.shippingState : null
  };
}

type ExistingAccount = {
  website?: string | null;
  type?: string | null;
  description?: string | null;
  phone?: string | null;
  rating?: string | null;
  numberOfEmployees?: number | null;
  annualRevenue?: unknown;
  industry?: string | null;
  billingCountry?: string | null;
  billingStreet?: string | null;
  billingPostalCode?: string | null;
  billingCity?: string | null;
  billingState?: string | null;
  shippingCountry?: string | null;
  shippingStreet?: string | null;
  shippingPostalCode?: string | null;
  shippingCity?: string | null;
  shippingState?: string | null;
};

/**
 * Gap-fill an existing Account from the Lead (and optional overrides) without
 * overwriting values the Account already has. Explicit convert overrides always win.
 */
export function buildAccountMergeData(
  existing: ExistingAccount,
  lead: ConvertibleLead,
  overrides: AccountOverrides = {}
) {
  const gap = <T>(
    overrideValue: T | null | undefined,
    current: T | null | undefined,
    fromLead: T | null | undefined
  ) => (overrideValue !== undefined ? overrideValue : (current ?? fromLead ?? null));

  return {
    website: gap(overrides.website, existing.website, lead.website),
    type: overrides.type !== undefined ? overrides.type : (existing.type ?? null),
    description: gap(overrides.description, existing.description, lead.description),
    phone: gap(overrides.phone, existing.phone, lead.phone),
    rating: gap(overrides.rating, existing.rating, lead.rating),
    numberOfEmployees:
      overrides.numberOfEmployees !== undefined
        ? overrides.numberOfEmployees
        : (existing.numberOfEmployees ?? lead.numberOfEmployees ?? null),
    annualRevenue:
      overrides.annualRevenue !== undefined
        ? overrides.annualRevenue
        : (decimalString(existing.annualRevenue) ?? decimalString(lead.annualRevenue)),
    industry: gap(overrides.industry, existing.industry, lead.industry),
    billingCountry: gap(overrides.billingCountry, existing.billingCountry, lead.country),
    billingStreet: gap(overrides.billingStreet, existing.billingStreet, lead.street),
    billingPostalCode: gap(overrides.billingPostalCode, existing.billingPostalCode, lead.postalCode),
    billingCity: gap(overrides.billingCity, existing.billingCity, lead.city),
    billingState: gap(overrides.billingState, existing.billingState, lead.state),
    shippingCountry:
      overrides.shippingCountry !== undefined ? overrides.shippingCountry : (existing.shippingCountry ?? null),
    shippingStreet:
      overrides.shippingStreet !== undefined ? overrides.shippingStreet : (existing.shippingStreet ?? null),
    shippingPostalCode:
      overrides.shippingPostalCode !== undefined ? overrides.shippingPostalCode : (existing.shippingPostalCode ?? null),
    shippingCity: overrides.shippingCity !== undefined ? overrides.shippingCity : (existing.shippingCity ?? null),
    shippingState: overrides.shippingState !== undefined ? overrides.shippingState : (existing.shippingState ?? null)
  };
}

export function buildContactData(lead: ConvertibleLead, accountId: string, overrides: ContactOverrides = {}) {
  return {
    salutation: override(overrides.salutation, lead.salutation),
    firstName: override(overrides.firstName, lead.firstName),
    lastName: String(overrides.lastName ?? "").trim() || String(lead.lastName ?? "").trim() || "Converted Lead",
    accountId,
    title: override(overrides.title, lead.title),
    reportsToContactId: overrides.reportsToContactId !== undefined ? overrides.reportsToContactId : null,
    description: override(overrides.description, lead.description),
    ownerId: override(overrides.ownerId, lead.ownerId) || lead.ownerId,
    phone: override(overrides.phone, lead.phone),
    email: override(overrides.email, lead.email),
    birthDate: overrides.birthDate ? new Date(overrides.birthDate) : null,
    leadSource: override(overrides.leadSource, lead.leadSource),
    mailingCountry: override(overrides.mailingCountry, lead.country),
    mailingStreet: override(overrides.mailingStreet, lead.street),
    mailingPostalCode: override(overrides.mailingPostalCode, lead.postalCode),
    mailingCity: override(overrides.mailingCity, lead.city),
    mailingState: override(overrides.mailingState, lead.state)
  };
}

function override(value: string | null | undefined, fallback: string | null | undefined) {
  return value === undefined ? (fallback ?? null) : value;
}

type ExistingContact = {
  salutation?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  title?: string | null;
  description?: string | null;
  phone?: string | null;
  email?: string | null;
  leadSource?: string | null;
  mailingCountry?: string | null;
  mailingStreet?: string | null;
  mailingPostalCode?: string | null;
  mailingCity?: string | null;
  mailingState?: string | null;
};

/**
 * Re-parent an existing contact onto the converted account, filling only the
 * fields it is currently missing so the conversion never overwrites better data.
 * accountId is always set (convert already chose the Account).
 */
export function buildContactMergeData(existing: ExistingContact, lead: ConvertibleLead, accountId: string) {
  return {
    accountId,
    salutation: existing.salutation ?? lead.salutation ?? null,
    firstName: existing.firstName ?? lead.firstName ?? null,
    lastName: String(existing.lastName ?? "").trim() || String(lead.lastName ?? "").trim() || "Converted Lead",
    title: existing.title ?? lead.title ?? null,
    description: existing.description ?? lead.description ?? null,
    phone: existing.phone ?? lead.phone ?? null,
    email: existing.email ?? lead.email ?? null,
    leadSource: existing.leadSource ?? lead.leadSource ?? null,
    mailingCountry: existing.mailingCountry ?? lead.country ?? null,
    mailingStreet: existing.mailingStreet ?? lead.street ?? null,
    mailingPostalCode: existing.mailingPostalCode ?? lead.postalCode ?? null,
    mailingCity: existing.mailingCity ?? lead.city ?? null,
    mailingState: existing.mailingState ?? lead.state ?? null
  };
}

export function buildOpportunityData(
  lead: ConvertibleLead,
  accountId: string,
  contactId: string,
  options: {
    name: string;
    closeDate: Date;
    stage: string;
    forecastCategory: string;
    amount: string | null;
    description?: string | null;
    ownerId?: string;
    probability?: number | null;
    nextStep?: string | null;
    leadSource?: string | null;
    courier?: string | null;
    trackingNumber?: string | null;
  }
) {
  return {
    name: options.name,
    accountId,
    contactId,
    closeDate: options.closeDate,
    amount: options.amount,
    description: options.description !== undefined ? options.description : (lead.description ?? null),
    ownerId: options.ownerId?.trim() || lead.ownerId,
    stage: options.stage,
    probability: options.probability ?? probabilityForStage(options.stage),
    forecastCategory: options.forecastCategory,
    nextStep: options.nextStep !== undefined ? options.nextStep : CONVERSION_NEXT_STEP,
    leadSource: options.leadSource !== undefined ? options.leadSource : (lead.leadSource ?? null),
    courier: options.courier ?? null,
    trackingNumber: options.trackingNumber ?? null
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
