export type PublicLeadOwner = {
  id: string;
  name: string | null;
  alias: string | null;
  email: string | null;
};

export type PublicLeadShipment = {
  id: string;
  carrier: string;
  trackingNumber: string;
  status: string;
  statusSummary: string | null;
  expectedDeliveryAt: string | null;
  lastEventAt: string | null;
  lastEventDescription: string | null;
  deliveredAt: string | null;
};

export type PublicLeadDeleted = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  email: string | null;
  deletedAt: string;
};

type JsonRecord = Record<string, unknown>;

function iso(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function publicProduct(product: JsonRecord) {
  return {
    id: product.id,
    name: product.name,
    family: product.family ?? null,
    productCode: product.productCode ?? null,
    sku: product.sku ?? null,
    category: product.category ?? null,
    active: Boolean(product.active),
    description: product.description ?? null,
    upcGtin: product.upcGtin ?? null,
    imageLink: product.imageLink ?? null,
    price: product.price ?? null,
    productType: product.productType ?? null,
    collectionName: product.collectionName ?? null,
    manufacturerName: product.manufacturerName ?? null
  };
}

function publicShipment(shipment: JsonRecord | null | undefined): PublicLeadShipment | null {
  if (!shipment) return null;
  return {
    id: String(shipment.id),
    carrier: String(shipment.carrier ?? ""),
    trackingNumber: String(shipment.trackingNumber ?? ""),
    status: String(shipment.status ?? ""),
    statusSummary: shipment.statusSummary == null ? null : String(shipment.statusSummary),
    expectedDeliveryAt: iso(shipment.expectedDeliveryAt as Date | string | null),
    lastEventAt: iso(shipment.lastEventAt as Date | string | null),
    lastEventDescription: shipment.lastEventDescription == null ? null : String(shipment.lastEventDescription),
    deliveredAt: iso(shipment.deliveredAt as Date | string | null)
  };
}

export function serializePublicLead(
  lead: JsonRecord,
  owner: PublicLeadOwner | null,
  shipment: JsonRecord | null | undefined
) {
  const row = jsonClone(lead);
  const sampleProducts = Array.isArray(row.sampleProducts) ? row.sampleProducts : [];
  return {
    id: String(row.id),
    organizationId: String(row.organizationId),
    status: String(row.status ?? "New"),
    salutation: row.salutation ?? null,
    firstName: row.firstName ?? null,
    lastName: row.lastName ?? null,
    company: row.company ?? null,
    title: row.title ?? null,
    website: row.website ?? null,
    description: row.description ?? null,
    ownerId: String(row.ownerId),
    owner: owner ?? { id: String(row.ownerId), name: null, alias: null, email: null },
    rating: row.rating ?? null,
    phone: row.phone ?? null,
    email: row.email ?? null,
    country: row.country ?? null,
    street: row.street ?? null,
    postalCode: row.postalCode ?? null,
    city: row.city ?? null,
    state: row.state ?? null,
    numberOfEmployees: row.numberOfEmployees ?? null,
    annualRevenue: row.annualRevenue ?? null,
    leadSource: row.leadSource ?? null,
    industry: row.industry ?? null,
    sampleRequestedDate: iso(row.sampleRequestedDate as Date | string | null),
    sampleStatus: row.sampleStatus ?? null,
    courier: row.courier ?? null,
    trackingNumber: row.trackingNumber ?? null,
    deliveryDate: iso(row.deliveryDate as Date | string | null),
    convertedAt: iso(row.convertedAt as Date | string | null),
    convertedAccountId: row.convertedAccountId ?? null,
    convertedContactId: row.convertedContactId ?? null,
    convertedOpportunityId: row.convertedOpportunityId ?? null,
    createdById: String(row.createdById),
    updatedById: String(row.updatedById),
    createdAt: iso(row.createdAt as Date | string) ?? "",
    updatedAt: iso(row.updatedAt as Date | string) ?? "",
    sampleProducts: sampleProducts.map((line) => {
      const sample = jsonClone(line as JsonRecord);
      const product =
        sample.product && typeof sample.product === "object" ? publicProduct(sample.product as JsonRecord) : null;
      return {
        id: sample.id,
        productId: sample.productId,
        quantity: sample.quantity,
        unitPrice: sample.unitPrice,
        totalPrice: sample.totalPrice,
        description: sample.description ?? null,
        displayOrder: sample.displayOrder,
        product
      };
    }),
    shipment: publicShipment(shipment)
  };
}

export type PublicLead = ReturnType<typeof serializePublicLead>;

export function serializeDeletedLead(
  lead: Pick<PublicLeadDeleted, "id" | "firstName" | "lastName" | "company" | "email">,
  deletedAt = new Date()
): PublicLeadDeleted {
  return {
    id: lead.id,
    firstName: lead.firstName ?? null,
    lastName: lead.lastName ?? null,
    company: lead.company ?? null,
    email: lead.email ?? null,
    deletedAt: deletedAt.toISOString()
  };
}
