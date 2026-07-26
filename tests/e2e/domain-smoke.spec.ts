import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";
import { e2eIds } from "./global-setup";

const runTag = `playwright-smoke-${Date.now()}`;
const prisma = new PrismaClient();

test.afterAll(async () => {
  const invoices = await prisma.invoice.findMany({
    where: { organizationId: e2eIds.primaryOrganization, notes: { contains: runTag } },
    select: { id: true }
  });
  const invoiceIds = invoices.map((invoice) => invoice.id);
  await prisma.invoicePayment.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
  await prisma.invoiceLineItem.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
  await prisma.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
  await prisma.event.deleteMany({
    where: { organizationId: e2eIds.primaryOrganization, description: { contains: runTag } }
  });
  await prisma.listViewPreference.deleteMany({
    where: { organizationId: e2eIds.primaryOrganization, viewName: { contains: runTag } }
  });
  await prisma.contact.deleteMany({
    where: { organizationId: e2eIds.primaryOrganization, lastName: { contains: runTag } }
  });
  await prisma.lead.deleteMany({
    where: { organizationId: e2eIds.primaryOrganization, company: { contains: runTag } }
  });
  await prisma.account.deleteMany({
    where: { organizationId: e2eIds.primaryOrganization, name: { contains: runTag } }
  });
  await prisma.$disconnect();
});

test("persists a list view and renders it through the Lightning route", async ({ page, request }) => {
  const viewName = `${runTag} leads`;
  const saved = await request.put("/api/list-views", {
    data: {
      object: "Lead",
      viewName,
      columns: ["displayName", "company", "status"],
      filters: [{ field: "status", operator: "equals", value: "New" }],
      isCustom: true
    }
  });
  expect(saved.ok()).toBeTruthy();
  await page.goto(`/lightning/o/Lead/list?filterName=${encodeURIComponent(viewName)}`);
  await expect(page.getByText(viewName, { exact: true }).first()).toBeVisible();
});

test("converts a lead through the typed action endpoint", async ({ request }) => {
  const created = await request.post("/api/records/Lead", {
    data: {
      status: "New",
      firstName: "Playwright",
      lastName: runTag,
      company: `${runTag} company`,
      email: `${runTag}@example.com`
    }
  });
  expect(created.status()).toBe(201);
  const lead = (await created.json()).record;
  const converted = await request.post("/api/actions/lead-conversion", {
    data: {
      object: "Lead",
      selectedIds: [lead.id],
      values: { createOpportunity: false }
    }
  });
  expect(converted.ok()).toBeTruthy();
  const result = (await converted.json()).data;
  expect(result.leads[0].convertedAt).toBeTruthy();
  expect(result.contacts).toHaveLength(1);
});

test("creates, expands, and deletes a recurring event", async ({ request }) => {
  const start = new Date(Date.now() + 86_400_000);
  start.setUTCHours(9, 0, 0, 0);
  const end = new Date(start.getTime() + 3_600_000);
  const created = await request.post("/api/records/Event", {
    data: {
      subject: "Meeting",
      description: runTag,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      assignedToId: e2eIds.user,
      recurrenceRule: "FREQ=DAILY;COUNT=3"
    }
  });
  expect(created.status()).toBe(201);
  const event = (await created.json()).record;
  const windowEnd = new Date(start.getTime() + 7 * 86_400_000);
  const expanded = await request.get(
    `/api/calendar/events?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(windowEnd.toISOString())}`
  );
  const occurrences = (await expanded.json()).items.filter((item: { id: string }) => item.id === event.id);
  expect(occurrences).toHaveLength(3);
  expect((await request.delete(`/api/records/Event/${event.id}?scope=all`)).ok()).toBeTruthy();
});

test("moves an invoice through draft and sent lifecycle states", async ({ request }) => {
  const created = await request.post("/api/invoices", {
    data: {
      accountId: e2eIds.primaryAccount,
      issueDate: "2026-07-01",
      dueDate: "2026-07-31",
      notes: runTag,
      lineItems: [{ description: runTag, quantity: 1, unitPrice: 25, discountAmount: 0, taxRate: 0 }]
    }
  });
  expect(created.status()).toBe(201);
  const invoice = (await created.json()).invoice;
  expect(invoice.status).toBe("Draft");
  const sent = await request.post(`/api/invoices/${invoice.id}/actions`, {
    data: { action: "mark-sent" }
  });
  expect(sent.ok()).toBeTruthy();
  expect((await sent.json()).invoice.status).toBe("Sent");
});
