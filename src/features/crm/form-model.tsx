import { FORM_DEFINITIONS } from "@/lib/crm-metadata";
import {
  type ScopedCrmData,
  type CrmObject,
  type FieldDefinition,
  type FormDefinition,
  type RecordData
} from "@/lib/crm-types";
import { formatDate, formatDateTime } from "@/lib/utils";
import { requiredId } from "@/features/crm/record-model";

/** Column order for CSV-style import lines — maps onto FORM_DEFINITIONS field names.
 * Intentional reduced set: only these columns are importable; other form fields get
 * New Object defaults via buildInitialValues. Import is exposed only for objects that
 * list "Import" in OBJECT_DEFINITIONS.actions (Account, Contact, Lead, Opportunity).
 */
export const IMPORT_COLUMNS: Partial<Record<CrmObject, string[]>> = {
  Account: ["name", "phone", "type"],
  Contact: ["firstName", "lastName", "accountName", "email"],
  Lead: ["firstName", "lastName", "company", "email"],
  Opportunity: ["name", "accountName", "closeDate", "stage", "forecastCategory"]
};

export function importColumnsLabel(object: CrmObject) {
  const columns = IMPORT_COLUMNS[object];
  if (!columns) return "";
  return columns
    .map((column) => (column === "accountName" ? "accountName (matched to Account)" : column))
    .join(", ");
}

export function importSampleForObject(object: CrmObject) {
  switch (object) {
    case "Account":
      return "Acme Corp, +1 555 0100, Customer";
    case "Contact":
      return "Jane, Buyer, Robert, jane@example.com";
    case "Lead":
      return "Sam, Prospect, Prospect Co, sam@example.com";
    case "Opportunity":
      return "Starter Renewal, Robert, 2026-08-31, Qualify, Pipeline";
    default:
      return "Name, Description";
  }
}

function resolveAccountId(accountName: string, data: ScopedCrmData) {
  const trimmed = accountName.trim();
  if (!trimmed) return null;
  const match = data.accounts.find((account) => String(account.name).toLowerCase() === trimmed.toLowerCase());
  return match ? requiredId(match) : null;
}

function defaultImportCloseDate(now = new Date()) {
  const date = new Date(now);
  date.setDate(date.getDate() + 30);
  return date.toISOString().slice(0, 10);
}

/**
 * Build a create payload from a CSV-style line using FORM_DEFINITIONS defaults via
 * buildInitialValues. Positional columns are listed in IMPORT_COLUMNS.
 */
export function importPayloadForObject(object: CrmObject, row: string, data: ScopedCrmData): RecordData | null {
  const columns = IMPORT_COLUMNS[object];
  if (!columns) return null;

  const parts = row.split(",").map((part) => part.trim());
  const mapped: RecordData = {};
  columns.forEach((column, index) => {
    const value = parts[index] ?? "";
    if (column === "accountName") {
      const accountId = resolveAccountId(value, data);
      if (!accountId) return;
      mapped.accountId = accountId;
      return;
    }
    if (column === "active") {
      mapped.active = value.toLowerCase() === "true" || value === "1";
      return;
    }
    if (value) mapped[column] = value;
  });

  if (
    (object === "Contact" || object === "Opportunity") &&
    columns.includes("accountName") &&
    !mapped.accountId
  ) {
    // Do not fall back to an arbitrary Account — fail the row instead.
    return null;
  }

  if (object === "Opportunity") {
    if (!mapped.closeDate) mapped.closeDate = defaultImportCloseDate();
    // Required companion when stage is provided but forecast is omitted from the line.
    if (mapped.stage && !mapped.forecastCategory) mapped.forecastCategory = "Pipeline";
  }

  const definition = FORM_DEFINITIONS[object];
  if (definition) {
    return buildInitialValues(definition, mapped, data.user.id);
  }

  return { ...mapped, ownerId: data.user.id };
}

export function buildInitialValues(
  definition: FormDefinition,
  record?: RecordData,
  currentUserId?: string
): RecordData {
  const values: RecordData = { ...(record ?? {}) };
  splitDateTimeField(values, "validFrom", "validFromTime");
  splitDateTimeField(values, "validTo", "validToTime");
  definition.fields.forEach((field) => {
    if (!record && field.name === "ownerId" && currentUserId) values[field.name] = currentUserId;
    else if (values[field.name] === undefined && field.defaultValue !== undefined)
      values[field.name] = field.defaultValue;
    else if (record && values[field.name] === undefined && field.name === "ownerId" && currentUserId)
      values[field.name] = currentUserId;
  });
  // When seeding from a partial record (import / convert), still fill ownerId if missing.
  if (values.ownerId === undefined && currentUserId && definition.fields.some((field) => field.name === "ownerId")) {
    values.ownerId = currentUserId;
  }
  return values;
}
export function splitDateTimeField(values: RecordData, dateField: string, timeField: string) {
  const raw = values[dateField];
  if (typeof raw !== "string" || !raw.includes("T")) return;
  const [datePart, timePart = "00:00"] = raw.split("T");
  values[dateField] = datePart;
  if (values[timeField] === undefined) values[timeField] = timePart.slice(0, 5);
}
export function recordDataShallowEqual(left: RecordData, right: RecordData) {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if (normalizeDirtyValue(left[key]) !== normalizeDirtyValue(right[key])) return false;
  }
  return true;
}
export function normalizeDirtyValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value) || typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}
export function validateFields(fields: FieldDefinition[], values: RecordData) {
  return Object.fromEntries(
    fields
      .filter((field) => field.required && (!values[field.name] || values[field.name] === "--None--"))
      .map((field) => [field.name, "Complete this field."])
  );
}
export function validateRequired(values: RecordData, required: string[]) {
  return Object.fromEntries(
    required
      .filter((field) => !values[field] || values[field] === "--None--")
      .map((field) => [field, "Complete this field."])
  );
}
export function groupBy<T>(items: T[], getKey: (item: T) => string) {
  return items.reduce<Record<string, T[]>>((accumulator, item) => {
    const key = getKey(item);
    accumulator[key] = accumulator[key] ?? [];
    accumulator[key].push(item);
    return accumulator;
  }, {});
}
export function formatCell(value: unknown) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return formatDateTime(value);
  return String(value);
}
export function formatListCell(object: CrmObject, record: RecordData, key: string) {
  if (object === "Invoice" && ["total", "amountPaid", "balanceDue"].includes(key)) {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: String(record.currency ?? "USD"),
      minimumFractionDigits: 2
    }).format(Number(record[key] ?? 0));
  }
  if (object === "Invoice" && ["issueDate", "dueDate"].includes(key) && record[key])
    return formatDate(String(record[key]));
  return formatCell(record[key]);
}
export function fieldLabel(field: string) {
  return field.replace(/([A-Z])/g, " $1").replace(/^./, (value) => value.toUpperCase());
}
export function addressValue(record: RecordData, prefix: string) {
  return [
    record[`${prefix}Street`],
    record[`${prefix}City`],
    record[`${prefix}State`],
    record[`${prefix}PostalCode`],
    record[`${prefix}Country`]
  ]
    .filter(Boolean)
    .join(", ");
}
