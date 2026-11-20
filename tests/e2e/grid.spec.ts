import { test, expect } from "@playwright/test";

test("shows loading, then pages through stable records and sorts by units", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page.getByText("Loading shipments…")).toBeVisible();
  const records = page.locator("tbody tr");
  await expect(page.getByText("Showing 1–10 of 128")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: testInfo.outputPath("relay-desktop.png"),
    fullPage: true,
  });
  const first = await records.first().locator("td").first().innerText();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByText("Showing 11–20 of 128")).toBeVisible();
  await expect(records.first().locator("td").first()).not.toHaveText(first);
  await page.getByRole("button", { name: "Units" }).click();
  await expect(page.getByText("Showing 1–10 of 128")).toBeVisible();
  const units = (await records.locator("td:last-child").allTextContents()).map(
    Number,
  );
  const descending =
    (await page
      .getByRole("columnheader", { name: "Units" })
      .getAttribute("aria-sort")) === "descending";
  expect(units).toEqual(
    [...units].sort((a, b) => (descending ? b - a : a - b)),
  );
});

test("combines filters, handles no results, clears and exports page", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("combobox", { name: "Filter by status" })
    .selectOption("Delivered");
  await page
    .getByRole("combobox", { name: "Filter by carrier" })
    .selectOption("Northline");
  await expect(page.locator("tbody tr").first()).toContainText("Delivered");
  await expect(page.locator("tbody tr").first()).toContainText("Northline");
  const rows = await page.locator("tbody tr").allTextContents();
  expect(
    rows.every((row) => row.includes("Delivered") && row.includes("Northline")),
  ).toBe(true);
  await page.getByRole("searchbox").fill("no-such-shipment-zz");
  await expect(
    page.getByRole("heading", { name: "No matching shipments" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).last().click();
  await expect(page.getByText("Showing 1–10 of 128")).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export page" }).click();
  expect((await downloadPromise).suggestedFilename()).toMatch(/\.csv$/);
});

test("recovers from a simulated query failure", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Showing 1–10 of 128")).toBeVisible();
  await page.getByRole("button", { name: "Simulate feed failure" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Could not load shipments",
  );
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByText("Showing 1–10 of 128")).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("changes page size and keeps the mobile table inside its scroll area", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByText("Showing 1–10 of 128")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("combobox", { name: "Rows per page" })
    .selectOption("25");
  await expect(
    page.locator("tbody tr").filter({ has: page.locator("time") }),
  ).toHaveCount(25);
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByText("Showing 26–50 of 128")).toBeVisible();
  await page.getByRole("searchbox").fill("Northstar");
  await expect(page.locator("tbody tr").first()).toContainText("Northstar");
  await expect(
    page.getByRole("button", { name: "Previous page" }),
  ).toBeDisabled();
});
