import { Prisma } from "@prisma/client";

export function serializeValue(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Prisma.Decimal) return value.toString();
  return value;
}

export function boundedJson(value: unknown) {
  return truncate(
    JSON.stringify(value, (_key, item) => serializeValue(item)),
    25_000
  );
}

export function truncate(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length)}…` : value;
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function displayName(record: Record<string, unknown>) {
  return [record.firstName, record.lastName].filter(Boolean).join(" ") || String(record.name ?? "Contact");
}

export function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

export function groupCounts<T>(items: T[], labelFor: (item: T) => string) {
  return items.reduce<Record<string, number>>((result, item) => {
    const label = labelFor(item) || "Unspecified";
    result[label] = (result[label] ?? 0) + 1;
    return result;
  }, {});
}
