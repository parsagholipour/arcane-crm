import { expect, test } from "@playwright/test";
import { e2eIds } from "./global-setup";

test.describe.serial("authenticated CRM smoke", () => {
  test("loads the shell, navigates, and exposes global search", async ({ page }) => {
    await page.goto("/lightning/page/home");
    await expect(page.locator("header span", { hasText: /^CRM$/ })).toBeVisible();
    await page.getByRole("button", { name: "Search..." }).click();
    await expect(page.getByPlaceholder("Search records, reports, and list views...")).toBeVisible();

    await page.goto("/lightning/o/Account/list");
    await expect(page.getByText("Primary Tenant Account", { exact: true })).toBeVisible();
  });

  test("keeps create modal state in the Lightning URL", async ({ page }) => {
    await page.goto("/lightning/o/Account/new");
    await expect(page).toHaveURL(/\/lightning\/o\/Account\/new$/);
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("New Account", { exact: true })).toBeVisible();
  });

  test("creates, edits, and deletes a generic record through typed record endpoints", async ({ request }) => {
    const created = await request.post("/api/records/Account", {
      data: { name: `Playwright lifecycle ${Date.now()}` }
    });
    expect(created.status()).toBe(201);
    const createdBody = await created.json();
    const id = String(createdBody.record.id);

    const updated = await request.patch(`/api/records/Account/${id}`, {
      data: { phone: "555-0199" }
    });
    expect(updated.ok()).toBeTruthy();
    expect((await updated.json()).record.phone).toBe("555-0199");

    const removed = await request.delete(`/api/records/Account/${id}`);
    expect(removed.ok()).toBeTruthy();
  });

  test("saves a new record by pressing Enter in a text field", async ({ page }) => {
    const accountName = `Enter save ${Date.now()}`;
    await page.goto("/lightning/o/Account/new");

    const dialog = page.getByRole("dialog");
    const name = dialog.locator("label").filter({ hasText: "Account Name" }).locator("input");
    await name.fill(accountName);
    await name.press("Enter");

    await expect(dialog).toBeHidden();
    await expect(page.getByRole("status")).toContainText("Account saved.");
  });

  test("isolates route data after an organization switch", async ({ page }) => {
    await page.goto("/lightning/page/home");
    const switchOrganization = (organizationId: string) =>
      page.evaluate(async (id) => {
        const response = await fetch("/api/organizations/active", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organizationId: id })
        });
        return response.status;
      }, organizationId);
    expect(await switchOrganization(e2eIds.secondaryOrganization)).toBe(200);
    await page.goto("/lightning/o/Account/list");
    await expect(page.getByText("Secondary Tenant Account", { exact: true })).toBeVisible();
    await expect(page.getByText("Primary Tenant Account", { exact: true })).toHaveCount(0);

    expect(await switchOrganization(e2eIds.primaryOrganization)).toBe(200);
  });
});
