import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { monthlyActivity, reportSnapshot } from "../lib/workspace-metrics";

const origin = "http://127.0.0.1:3218";
const tabs = [
  ["dashboard", "Community overview"],
  ["analytics", "Service analytics"],
  ["staff", "Staff accounts"],
  ["reports", "Community reports"],
  ["documents", "Document requests"],
  ["map", "Complaint map"],
  ["residents", "Resident verification"],
  ["announcements", "Announcements"],
] as const;

async function login(page: Page, role: "admin" | "staff" = "admin") {
  await page.goto("/admin/login");
  await page
    .getByLabel(role === "admin" ? "Administrator" : "Staff", { exact: true })
    .check();
  await page
    .getByLabel("Email address", { exact: true })
    .fill(role + "@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill(" synthetic password with spaces ");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Community overview" }),
  ).toBeVisible();
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
}
async function audit(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
}
test.beforeEach(async ({ page, request }) => {
  await request.post(origin + "/__reset");
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (["127.0.0.1", "localhost"].includes(url.hostname))
      return route.continue();
    if (url.hostname === "tile.openstreetmap.org")
      return route.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e7ede9"/><path d="M0 90H256M90 0V256M0 220H256M210 0V256" stroke="#ffffff" stroke-width="10"/><path d="M0 90H256M90 0V256" stroke="#c7d3cc" stroke-width="2"/><text x="8" y="30" font-size="10" fill="#688078">QA basemap</text></svg>',
      });
    return route.abort();
  });
});

test("analytics excludes other years, preserves zero, validates coordinates", () => {
  const reports = [
    {
      id: "1",
      created_at: "2025-01-04T12:00:00Z",
      status: "pending",
      latitude: 999,
      longitude: 118,
    },
    {
      id: "2",
      created_at: "2026-01-04T12:00:00Z",
      status: "resolved",
      latitude: 9,
      longitude: 118,
    },
    {
      id: "3",
      created_at: "invalid",
      status: "in progress",
      latitude: 0,
      longitude: 0,
    },
  ];
  const months = monthlyActivity(reports, [], 2026);
  expect(months[0].reports).toBe(1);
  expect(months[1].reports).toBe(0);
  const snapshot = reportSnapshot(reports, new Date("2026-02-01T12:00:00Z"));
  expect(snapshot.mapped).toBe(1);
  expect(snapshot.unmappedOpen).toBe(2);
  expect(snapshot.overdue).toBe(1);
  expect(reportSnapshot([]).resolutionRate).toBe(0);
});

test("login selection, labels, password integrity and session recovery", async ({
  page,
}) => {
  await page.goto("/admin/login");
  await audit(page);
  const requestPromise = page.waitForRequest((r) =>
    r.url().includes("/auth/v1/token"),
  );
  await login(page, "staff");
  expect((await requestPromise).postDataJSON().password).toBe(
    " synthetic password with spaces ",
  );
  await expect(
    page
      .getByRole("navigation")
      .getByRole("link", { name: "Analytics", exact: true }),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole("navigation")
      .getByRole("link", { name: "Staff Accounts", exact: true }),
  ).toHaveCount(0);
  await page.goto("/admin/staff");
  await expect(page).toHaveURL(/dashboard/);
  await page.goto("/admin/analytics");
  await expect(page).toHaveURL(/dashboard/);
  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await expect(page).toHaveURL(/login/);
});

for (const width of [1440, 768, 390]) {
  test(`all tabs: ${width}px, accessible landmarks, overflow and screenshots`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width, height: 1000 });
    await login(page);
    for (const [tab, title] of tabs) {
      await page.goto("/admin/" + tab);
      await expect(
        page.getByRole("heading", { level: 1, name: title, exact: true }),
      ).toBeVisible();
      await expect(page.locator(".admin-loading-overlay")).toHaveCount(0);
      await expect(page.locator("main")).toHaveCount(1);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(overflow, tab + " horizontal overflow").toBe(false);
      if (tab === "announcements") {
        const thumbnail = page.locator(".announcement-thumb").first();
        const image = thumbnail.locator("img");
        const frame = await thumbnail.boundingBox();
        const picture = await image.boundingBox();
        expect(frame).not.toBeNull();
        expect(picture).not.toBeNull();
        expect(picture!.y + picture!.height).toBeLessThanOrEqual(frame!.y + frame!.height + 1);
      }
      await audit(page);
      await page.screenshot({
        path: testInfo.outputPath(tab + "-" + width + ".png"),
        fullPage: true,
        animations: "disabled",
      });
    }
  });
}

test("document requests: consecutive updates, rejection validation, failure recovery", async ({
  page,
}) => {
  await login(page);
  await page.goto("/admin/documents");
  await page
    .getByRole("button", { name: "View details", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog", { name: "Document request details" });
  await audit(page);
  await dialog
    .getByRole("combobox", { name: "Update status", exact: true })
    .selectOption("processing");
  await dialog.getByRole("button", { name: "Update request" }).click();
  await expect(dialog.locator(".document-request-current")).toContainText(
    "Processing",
  );
  await dialog
    .getByRole("combobox", { name: "Update status", exact: true })
    .selectOption("ready_for_release");
  await dialog.getByRole("button", { name: "Update request" }).click();
  await expect(dialog.locator(".document-request-current")).toContainText(
    "Ready for Release",
  );
  await dialog
    .getByRole("combobox", { name: "Update status", exact: true })
    .selectOption("rejected");
  await expect(
    dialog.getByRole("button", { name: "Update request" }),
  ).toBeDisabled();
  await dialog
    .getByLabel("Reason shown to the resident")
    .fill("Please provide a readable proof of residence.");
  await dialog.getByRole("button", { name: "Update request" }).click();
  await expect(dialog.locator(".document-request-current")).toContainText(
    "Rejected",
  );
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "View details", exact: true }).first(),
  ).toBeFocused();
});

test("reports: keyboard details, note and status update, category filter", async ({
  page,
}) => {
  await login(page);
  await page.goto("/admin/reports");
  await page.getByLabel("Search community reports").fill("Road surface");
  const card = page.locator(".report-card");
  await expect(card).toHaveCount(1);
  await card
    .getByRole("button", {
      name: "Road surface damaged near the community center",
    })
    .focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "Report details" }),
  ).toBeVisible();
  await audit(page);
  await page.keyboard.press("Escape");
  await card.getByRole("button", { name: "Note", exact: true }).click();
  await page
    .getByLabel("Staff note visible to the resident")
    .fill("Inspection scheduled for tomorrow.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Edit staff note" }),
  ).toHaveCount(0);
  await card.getByLabel("Change report status").selectOption("in progress");
  await expect(card.getByLabel("Change report status")).toHaveValue(
    "in progress",
  );
  await card
    .getByRole("button", {
      name: "Road surface damaged near the community center",
    })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Inspection scheduled for tomorrow.",
  );
});

test("resident review: evidence, accessible confirmation and approval", async ({
  page,
}) => {
  await login(page);
  await page.goto("/admin/residents");
  await page.getByLabel("Search resident applications").fill("Maria Santos");
  await page
    .getByRole("button", { name: "View resident", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Before you approve");
  await audit(page);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Approve", exact: true })
    .click();
  const confirm = page.getByRole("dialog", {
    name: "Approve resident",
    exact: true,
  });
  await expect(confirm).toBeVisible();
  await audit(page);
  await confirm.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".resident-row")).toContainText("Approved");
});

test("staff: searchable directory, create form and role guard", async ({
  page,
}) => {
  await login(page);
  await page.goto("/admin/staff");
  await page.getByLabel("Search staff accounts").fill("Jamie");
  await expect(page.locator(".staff-directory-row")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Add staff account", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Create staff account",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await audit(page);
  await dialog
    .getByLabel("Full Name", { exact: true })
    .fill("Test Office Staff");
  await dialog
    .getByLabel("Email", { exact: true })
    .fill("newstaff@example.test");
  await dialog
    .getByLabel("Temporary Password", { exact: true })
    .fill("fixture-password-only-123");
  // Form contract validated in isolation; do not provision a real account.
  await page.route("**/api/admin/staff", (route) =>
    route.fulfill({ json: { ok: true } }),
  );
  await dialog
    .getByRole("button", { name: "Create Staff Account", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await page.getByLabel("Search staff accounts").fill("Alex");
  await page.getByLabel("Change role for Alex Reyes").selectOption("staff");
  await expect(
    page.getByRole("status").filter({ hasText: "At least one administrator" }),
  ).toBeVisible();
});

test("announcements: library, drafts, composer, preview and safe content", async ({
  page,
}) => {
  await login(page);
  await page.goto("/admin/announcements");
  await page.getByRole("button", { name: "Drafts", exact: true }).click();
  await expect(page.locator(".announcement-card")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Write announcement", exact: true })
    .click();
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  await page.getByLabel("Title", { exact: true }).fill("Synthetic QA notice");
  await page
    .getByRole("textbox", { name: "Announcement content", exact: true })
    .fill("Community service hours will be updated tomorrow.");
  await audit(page);
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(
    page
      .locator(".announcement-card")
      .filter({ hasText: "Synthetic QA notice" }),
  ).toBeVisible();
  await page
    .locator(".announcement-card")
    .filter({ hasText: "Synthetic QA notice" })
    .getByRole("button", { name: "View announcement" })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Announcement preview" }),
  ).toContainText("Community service hours");
  await audit(page);
});

test("map: filters, queue and marker selection remain synchronized", async ({
  page,
}) => {
  await login(page);
  await page.goto("/admin/map");
  await expect(page.locator(".queue-list > button")).toHaveCount(3);
  await page.getByRole("button", { name: "Resolved", exact: true }).click();
  await expect(page.locator(".queue-list > button")).toHaveCount(1);
  await page.locator(".queue-list > button").first().click();
  await expect(page.locator(".map-details-panel")).toContainText("Drainage");
  await page.getByRole("button", { name: "Pending", exact: true }).click();
  await expect(page.locator(".map-details-panel")).toHaveCount(0);
  await expect(page.locator(".queue-list > button")).toHaveCount(2);
});

test("mobile navigation: focus trap, Escape, route navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await login(page);
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Close navigation", exact: true }).first(),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    page.getByRole("button", { name: "Logout", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Open menu", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Document Requests", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Document requests",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open menu", exact: true }),
  ).toBeVisible();
});

test("failed document updates remain visible in the dialog and can be retried", async ({ page }) => {
  await login(page);
  await page.goto("/admin/documents");
  await page.getByRole("button", { name: "View details", exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "Document request details" });
  await dialog.getByRole("combobox", { name: "Update status", exact: true }).selectOption("processing");
  await page.route("**/api/admin/document-requests/*", route => route.fulfill({ status: 503, json: { message: "Connection interrupted. Please try again." } }));
  await dialog.getByRole("button", { name: "Update request" }).click();
  await expect(dialog.getByRole("status").filter({ hasText: "Connection interrupted" })).toBeVisible();
  await expect(dialog.locator(".document-request-current")).toContainText("Pending");
  await page.unroute("**/api/admin/document-requests/*");
  await dialog.getByRole("button", { name: "Update request" }).click();
  await expect(dialog.locator(".document-request-current")).toContainText("Processing");
});

test("announcement uploads disable saving until completed", async ({ page }) => {
  await login(page);
  await page.goto("/admin/announcements");
  await page.getByRole("button", { name: "Write announcement", exact: true }).click();
  let finishUpload!: () => void;
  const uploadGate = new Promise<void>(resolve => { finishUpload = resolve; });
  await page.route("**/api/admin/announcements/upload", async route => {
    await uploadGate;
    await route.fulfill({ json: { url: origin + "/evidence.svg" } });
  });
  await page.locator('input[type="file"]').first().setInputFiles({
    name: "qa-only.png", mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64")
  });
  try {
    await expect(page.getByRole("button", { name: "Save draft", exact: true })).toBeDisabled();
    await expect(page.getByText("Uploading image files...", { exact: true })).toBeVisible();
  } finally { finishUpload(); }
  await expect(page.getByRole("button", { name: "Save draft", exact: true })).toBeEnabled();
  await expect(page.locator(".announcement-thumbnail-preview img")).toBeVisible();
});

test("empty and failed requests have understandable recovery", async ({
  page,
}) => {
  await login(page);
  await page.route("**/rest/v1/reports?**", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.goto("/admin/reports");
  await expect(
    page.getByText("No reports found.", { exact: true }),
  ).toBeVisible();
  await page.unroute("**/rest/v1/reports?**");
  await page.route("**/rest/v1/reports?**", (route) =>
    route.fulfill({
      status: 503,
      json: { message: "Synthetic network failure" },
    }),
  );
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.locator(".admin-message")).toBeVisible();
  await page.unroute("**/rest/v1/reports?**");
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.locator(".report-card")).toHaveCount(5);
});
