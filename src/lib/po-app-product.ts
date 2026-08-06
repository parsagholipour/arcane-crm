import { z } from "zod";

/**
 * Pure mapping and scheduling policy for the PO App catalogue. No I/O and no Prisma, so the
 * rules that are easy to get wrong — money precision, empty-vs-null, out-of-order writes,
 * backoff — are cheap to cover with unit tests.
 *
 * Schemas are deliberately permissive: docs/PO-API.md §14 guarantees new fields may appear on
 * any response at any time, so an unrecognised shape must never fail a whole page.
 */

export const PO_APP_EDITING_STATUSES = ["standard", "final_stock", "one_print_only", "discontinued"] as const;
export type PoAppEditingStatus = (typeof PO_APP_EDITING_STATUSES)[number];

const relationSchema = z.object({ id: z.string().nullish(), name: z.string().nullish() }).passthrough();

export const poAppProductSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().nullish(),
    sku: z.string().nullish(),
    upcGtin: z.string().nullish(),
    description: z.string().nullish(),
    imageLink: z.string().nullish(),
    cost: z.number().nullish(),
    price: z.number().nullish(),
    map: z.number().nullish(),
    msrp: z.number().nullish(),
    mop: z.number().nullish(),
    quantityPerCarton: z.number().nullish(),
    stockCount: z.number().nullish(),
    orderByDate: z.string().nullish(),
    editingStatus: z.string().nullish(),
    verified: z.boolean().nullish(),
    defaultManufacturer: z
      .object({
        id: z.string().nullish(),
        name: z.string().nullish(),
        region: z.string().nullish(),
        email: z.string().nullish(),
        contactNumber: z.string().nullish()
      })
      .passthrough()
      .nullish(),
    category: relationSchema.nullish(),
    type: relationSchema.nullish(),
    collection: relationSchema.nullish(),
    createdAt: z.string().nullish(),
    updatedAt: z.string().nullish()
  })
  .passthrough();

export type PoAppProduct = z.infer<typeof poAppProductSchema>;

export type PoAppProductMapping = {
  poAppProductId: string;
  poAppUpdatedAt: Date | null;
  name: string;
  sku: string | null;
  productCode: string | null;
  description: string | null;
  category: string | null;
  family: string | null;
  upcGtin: string | null;
  imageLink: string | null;
  cost: string | null;
  price: string | null;
  mapPrice: string | null;
  msrp: string | null;
  minimumOrderPieces: number | null;
  quantityPerCarton: number | null;
  stockCount: number | null;
  orderByDate: Date | null;
  editingStatus: PoAppEditingStatus;
  verified: boolean;
  manufacturerName: string | null;
  manufacturerRegion: string | null;
  manufacturerEmail: string | null;
  manufacturerPhone: string | null;
  productType: string | null;
  collectionName: string | null;
};

/** Trims and collapses "" to null. imageLink in particular defaults to "" rather than null. */
function text(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

/**
 * Money crosses the wire as a JSON number but is an exact decimal server side. Formatting to a
 * fixed two-place string hands Prisma an exact value instead of a float.
 */
function money(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value.toFixed(2);
}

function count(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.trunc(value);
}

export function parseTimestamp(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * orderByDate carries a time component but is only meaningful as a calendar date, so the time
 * is dropped rather than being re-interpreted in the server's timezone.
 */
function calendarDate(value: unknown) {
  if (typeof value !== "string" || value.length < 10) return null;
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** New values may ship at any time; an unrecognised one is treated as the safe default. */
export function normalizeEditingStatus(value: unknown): PoAppEditingStatus {
  const candidate = typeof value === "string" ? value.trim().toLowerCase() : "";
  return (PO_APP_EDITING_STATUSES as readonly string[]).includes(candidate)
    ? (candidate as PoAppEditingStatus)
    : "standard";
}

export function mapPoAppProduct(product: PoAppProduct): PoAppProductMapping {
  const sku = text(product.sku);
  const manufacturer = product.defaultManufacturer ?? null;
  return {
    poAppProductId: product.id,
    poAppUpdatedAt: parseTimestamp(product.updatedAt),
    name: text(product.name) ?? sku ?? "Untitled PO App product",
    sku,
    productCode: sku,
    description: text(product.description),
    category: text(product.category?.name),
    family: text(product.collection?.name),
    upcGtin: text(product.upcGtin),
    imageLink: text(product.imageLink),
    cost: money(product.cost),
    price: money(product.price),
    mapPrice: money(product.map),
    msrp: money(product.msrp),
    minimumOrderPieces: count(product.mop),
    quantityPerCarton: count(product.quantityPerCarton),
    stockCount: count(product.stockCount),
    orderByDate: calendarDate(product.orderByDate),
    editingStatus: normalizeEditingStatus(product.editingStatus),
    verified: product.verified === true,
    manufacturerName: text(manufacturer?.name),
    manufacturerRegion: text(manufacturer?.region),
    manufacturerEmail: text(manufacturer?.email),
    manufacturerPhone: text(manufacturer?.contactNumber),
    productType: text(product.type?.name),
    collectionName: text(product.collection?.name)
  };
}

/**
 * Webhook order is not guaranteed and a retry of an older event can land after a newer one, so
 * a write only applies when it is at least as new as what is already stored. Equal timestamps
 * still apply: polling re-delivers unchanged rows and the upsert is idempotent.
 */
export function shouldApplyPoAppUpdate(incoming: Date | null, stored: Date | null | undefined) {
  if (!stored) return true;
  if (!incoming) return true;
  return incoming.getTime() >= stored.getTime();
}

/**
 * Backoff for a failing sync. A rejected or expired token will not fix itself, so credential
 * failures wait hours instead of minutes rather than burning the rate limit.
 */
export function poAppRetryDelayMinutes(failureCount: number, credentialFailure = false) {
  if (credentialFailure) return 360;
  if (failureCount <= 1) return 5;
  if (failureCount === 2) return 15;
  if (failureCount === 3) return 30;
  if (failureCount === 4) return 60;
  return 120;
}

export const MIN_SYNC_INTERVAL_MINUTES = 15;
export const MAX_SYNC_INTERVAL_MINUTES = 24 * 60;

export function normalizeSyncIntervalMinutes(value: unknown) {
  const minutes = typeof value === "number" ? Math.trunc(value) : Number.NaN;
  if (!Number.isFinite(minutes)) return 60;
  return Math.max(MIN_SYNC_INTERVAL_MINUTES, Math.min(minutes, MAX_SYNC_INTERVAL_MINUTES));
}
