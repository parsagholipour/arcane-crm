import { Prisma } from "@prisma/client";
import type { CrmObject, RecordData } from "@/lib/crm-types";

export class RecordPayloadValidationError extends Error {
  constructor(message: string, readonly fields: string[]) {
    super(message);
    this.name = "RecordPayloadValidationError";
  }
}

const LEAD_STATUSES = new Set(["New", "Contacted", "Nurturing", "Qualified", "Unqualified"]);
const OPPORTUNITY_STAGES = new Set(["Qualify", "Meet & Present", "Propose", "Negotiate", "Closed Won", "Closed Lost"]);
const FORECAST_CATEGORIES = new Set(["Pipeline", "Best Case", "Commit", "Closed", "Omitted"]);
const CASE_STATUSES = new Set(["New", "Working", "Waiting on Customer", "Escalated", "Closed"]);
const CASE_PRIORITIES = new Set(["Low", "Medium", "High"]);

export function validateRecordPayload(object: CrmObject, payload: RecordData) {
  if (object === "Contact") {
    optionalDate(payload.birthDate, "Choose a valid birthdate.", "birthDate");
    optionalEmail(payload.email, "email");
  }
  if (object === "Lead") {
    optionalChoice(payload.status, LEAD_STATUSES, "Choose a valid Lead Status.", "status");
    optionalEmail(payload.email, "email");
    optionalNonNegativeInteger(payload.numberOfEmployees, "Number of Employees", "numberOfEmployees");
    optionalNonNegativeDecimal(payload.annualRevenue, "Annual Revenue", "annualRevenue");
  }
  if (object === "Opportunity") {
    optionalDate(payload.closeDate, "Choose a valid Close Date.", "closeDate");
    optionalChoice(payload.stage, OPPORTUNITY_STAGES, "Choose a valid Stage.", "stage");
    optionalChoice(payload.forecastCategory, FORECAST_CATEGORIES, "Choose a valid Forecast Category.", "forecastCategory");
    optionalNonNegativeDecimal(payload.amount, "Amount", "amount");
    if (payload.probability !== null && payload.probability !== undefined) {
      const probability = Number(payload.probability);
      if (!Number.isInteger(probability) || probability < 0 || probability > 100) {
        throw new RecordPayloadValidationError("Probability must be a whole number from 0 through 100.", ["probability"]);
      }
    }
  }
  if (object === "Case") {
    optionalChoice(payload.status, CASE_STATUSES, "Choose a valid Case Status.", "status");
    optionalChoice(payload.priority, CASE_PRIORITIES, "Choose a valid Case Priority.", "priority");
  }
  if (object === "Product2") optionalNonNegativeDecimal(payload.listPrice, "List Price", "listPrice");
  if (object === "Pricebook2") validatePriceBookDates(payload);
  if (object === "Event") {
    optionalDate(payload.startAt, "Choose a valid event start time.", "startAt");
    optionalDate(payload.endAt, "Choose a valid event end time.", "endAt");
  }
  if (object === "ListEmail") optionalDate(payload.scheduledAt, "Choose a valid scheduled date and time.", "scheduledAt");
  if (object === "Knowledge__kav" && payload.urlName !== null && payload.urlName !== undefined) {
    const urlName = String(payload.urlName).trim();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(urlName)) {
      throw new RecordPayloadValidationError("URL Name can contain lowercase letters, numbers, and single hyphens.", ["urlName"]);
    }
  }
}

function optionalDate(value: unknown, message: string, field: string) {
  if (value === null || value === undefined) return;
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime())) throw new RecordPayloadValidationError(message, [field]);
}

function optionalEmail(value: unknown, field: string) {
  if (value === null || value === undefined || String(value).trim() === "") return;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim())) {
    throw new RecordPayloadValidationError("Enter a valid email address.", [field]);
  }
}

function optionalChoice(value: unknown, choices: Set<string>, message: string, field: string) {
  if (value === null || value === undefined) return;
  if (!choices.has(String(value))) throw new RecordPayloadValidationError(message, [field]);
}

function optionalNonNegativeInteger(value: unknown, label: string, field: string) {
  if (value === null || value === undefined) return;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new RecordPayloadValidationError(`${label} must be a non-negative whole number.`, [field]);
}

function optionalNonNegativeDecimal(value: unknown, label: string, field: string) {
  if (value === null || value === undefined) return;
  try {
    const decimal = new Prisma.Decimal(String(value));
    if (!decimal.isFinite() || decimal.isNegative()) throw new Error("invalid");
  } catch {
    throw new RecordPayloadValidationError(`${label} must be a non-negative number.`, [field]);
  }
}

function validatePriceBookDates(payload: RecordData) {
  const from = combinedDate(payload.validFrom, payload.validFromTime, "validFrom");
  const to = combinedDate(payload.validTo, payload.validToTime, "validTo");
  if (from && to && to < from) throw new RecordPayloadValidationError("Valid To cannot precede Valid From.", ["validTo"]);
}

function combinedDate(dateValue: unknown, timeValue: unknown, field: string) {
  if (dateValue === null || dateValue === undefined) return null;
  const source = String(dateValue);
  const date = new Date(source.includes("T") ? source : `${source}T${String(timeValue ?? "00:00").slice(0, 5)}:00.000Z`);
  if (!Number.isFinite(date.getTime())) throw new RecordPayloadValidationError("Choose a valid date and time.", [field]);
  return date;
}
