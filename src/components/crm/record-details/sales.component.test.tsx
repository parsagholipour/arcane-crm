import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { type ScopedCrmData, type RecordData } from "@/lib/crm-types";
import { SalesRecordDetailPage } from "./sales";

const sampleLine = {
  id: "sample-1",
  leadId: "lead-1",
  productId: "product-1",
  quantity: "2",
  unitPrice: "150.00",
  totalPrice: "300.00",
  product: { id: "product-1", name: "Installed Widget", productCode: "WID-1" }
};

const lead: RecordData = {
  id: "lead-1",
  firstName: "Dana",
  lastName: "Reed",
  status: "Sample requested",
  sampleStatus: "Shipped",
  sampleRequestedDate: "2026-08-01T00:00:00.000Z",
  courier: "USPS",
  trackingNumber: "9400100000000000000000",
  sampleProducts: [sampleLine],
  shipment: { id: "tracking-1", status: "InTransit", statusSummary: "In transit to next facility" }
};

const data = {
  user: { id: "user-1", name: "Primary User", alias: "primary" },
  users: [{ id: "user-1", name: "Primary User", alias: "primary" }],
  accounts: [],
  contacts: [],
  leads: [lead],
  opportunities: [],
  invoices: [],
  products: [],
  priceBookEntries: [],
  campaignMembers: [],
  tasks: [],
  emailActivities: [],
  callActivities: [],
  events: []
} as unknown as ScopedCrmData;

function renderLead(record: RecordData = lead) {
  render(
    <SalesRecordDetailPage
      object="Lead"
      record={record}
      data={data}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
      onChangeOwner={vi.fn()}
      onWorkflow={vi.fn()}
      onDataChange={vi.fn()}
      onToast={vi.fn()}
    />
  );
}

describe("Lead record page sample section", () => {
  it("renders the Sample Products card the same way the Opportunity page renders Products", () => {
    renderLead();

    expect(screen.getByText("Sample Products (1)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add Sample Product/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Installed Widget" })).toHaveAttribute(
      "href",
      "/lightning/r/Product2/product-1/view"
    );
    expect(screen.getByText("Total Sample Amount")).toBeInTheDocument();
  });

  it("shows the sample request fields and the live USPS shipment", () => {
    renderLead();

    expect(screen.getByText("Sample Requested Date")).toBeInTheDocument();
    expect(screen.getByText("Sample Status")).toBeInTheDocument();
    expect(screen.getByText("Shipped")).toBeInTheDocument();
    expect(screen.getByText("Shipment")).toBeInTheDocument();
    expect(screen.getByText("In Transit")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "9400100000000000000000" })).toBeInTheDocument();
  });

  it("freezes the sample lines once the Lead is converted", () => {
    renderLead({ ...lead, convertedAt: "2026-08-10T00:00:00.000Z" });

    expect(screen.getByText("Sample Products (1)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add Sample Product/ })).not.toBeInTheDocument();
  });
});
