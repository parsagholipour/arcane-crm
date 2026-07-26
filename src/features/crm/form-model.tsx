import {
  type ScopedCrmData,
  type CrmObject,
  type FieldDefinition,
  type FormDefinition,
  type RecordData
} from "@/lib/crm-types";
import { formatDate, formatDateTime } from "@/lib/utils";
import { requiredId } from "@/features/crm/record-model";

export function importSampleForObject(object: CrmObject) {
  switch (object) {
    case "Account":
      return "Acme Corp, +1 555 0100, Customer";
    case "Contact":
      return "Jane, Buyer, Robert, jane@example.com";
    case "Lead":
      return "Sam, Prospect, Prospect Co, sam@example.com";
    case "Opportunity":
      return "Starter Renewal, Robert, 2026-08-31, Qualify";
    case "Case":
      return "Login issue, New, Medium, Email";
    case "Product2":
      return "Starter Product, None, SKU-100";
    case "Pricebook2":
      return "Partner Price Book, true";
    default:
      return "Name, Description";
  }
}
export function importPayloadForObject(object: CrmObject, row: string, data: ScopedCrmData): RecordData | null {
  const [a = "", b = "", c = "", d = ""] = row.split(",").map((part) => part.trim());
  const accountId = requiredId(
    data.accounts.find((account) => String(account.name).toLowerCase() === c.toLowerCase()) ?? data.accounts[0] ?? {}
  );
  const opportunityAccountId = requiredId(
    data.accounts.find((account) => String(account.name).toLowerCase() === b.toLowerCase()) ?? data.accounts[0] ?? {}
  );
  const defaultAccountId = requiredId(data.accounts[0] ?? {});

  switch (object) {
    case "Account":
      return { name: a || "Imported Account", phone: b, type: c || "Customer", ownerId: data.user.id };
    case "Contact":
      return {
        firstName: a,
        lastName: b || "Imported",
        accountId: accountId || defaultAccountId,
        email: d,
        ownerId: data.user.id
      };
    case "Lead":
      return {
        firstName: a,
        lastName: b || "Imported",
        company: c || "Imported Company",
        email: d,
        status: "New",
        ownerId: data.user.id
      };
    case "Opportunity":
      return {
        name: a || "Imported Opportunity",
        accountId: opportunityAccountId || defaultAccountId,
        closeDate: c || "2026-08-31",
        stage: d || "Qualify",
        forecastCategory: "Pipeline",
        ownerId: data.user.id
      };
    case "Case":
      return { subject: a, status: b || "New", priority: c || "Medium", origin: d || "Email", ownerId: data.user.id };
    case "Product2":
      return { name: a || "Imported Product", family: b || "None", sku: c, active: false };
    case "Pricebook2":
      return { name: a || "Imported Price Book", active: b.toLowerCase() === "true" };
    default:
      return null;
  }
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
  });
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
