import { test, expect, type Locator, type Page } from "@playwright/test";
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
  ["residents", "Resident accounts"],
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

async function chooseDropdownOption(
  page: Page,
  scope: Page | Locator,
  label: string,
  option: string,
) {
  const trigger = scope.getByRole("combobox", { name: label, exact: true });
  await trigger.click();
  await page.getByRole("option", { name: option, exact: true }).click();
  return trigger;
}

async function expectMenuInViewport(menu: Locator) {
  await expect(menu).toBeVisible();
  await expect.poll(() => menu.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const viewport = window.visualViewport;
    const left = viewport?.offsetLeft ?? 0;
    const top = viewport?.offsetTop ?? 0;
    const right = left + (viewport?.width ?? window.innerWidth);
    const bottom = top + (viewport?.height ?? window.innerHeight);
    return rect.width > 0 && rect.height > 0 &&
      rect.left >= left - 1 && rect.top >= top - 1 &&
      rect.right <= right + 1 && rect.bottom <= bottom + 1;
  })).toBe(true);
}

async function expectMenuAnchored(trigger: Locator, menu: Locator) {
  await expect.poll(async () => {
    const triggerBox = await trigger.boundingBox();
    const menuBox = await menu.boundingBox();
    if (!triggerBox || !menuBox) return false;
    const placement = await menu.getAttribute("data-placement");
    const distance = placement === "top"
      ? triggerBox.y - (menuBox.y + menuBox.height)
      : menuBox.y - (triggerBox.y + triggerBox.height);
    return distance >= 3 && distance <= 7;
  }).toBe(true);
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
  await dialog.getByRole("button",{name:"Review request",exact:true}).click();
  await audit(page);
  await chooseDropdownOption(page, dialog, "Update status", "Processing");
  await dialog.getByRole("button", { name: "Update request" }).click();
  await expect(dialog.locator(".document-request-current")).toContainText(
    "Processing",
  );
  await chooseDropdownOption(
    page,
    dialog,
    "Update status",
    "Ready for release",
  );
  await dialog.getByRole("button", { name: "Update request" }).click();
  await expect(dialog.locator(".document-request-current")).toContainText(
    "Ready for release",
  );
  await chooseDropdownOption(page, dialog, "Update status", "Rejected");
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
  const reportStatus = await chooseDropdownOption(
    page,
    card,
    "Change report status",
    "In Progress",
  );
  await expect(reportStatus).toHaveAttribute("data-value", "in progress");
  await card
    .getByRole("button", {
      name: "Road surface damaged near the community center",
    })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Inspection scheduled for tomorrow.",
  );
});

test("dropdown menus support keyboard selection and dismissal", async ({
  page,
}) => {
  await login(page);
  await page.goto("/admin/reports");
  await page.getByLabel("Search community reports").fill("Road surface");
  const dropdown = page.getByRole("combobox", {
    name: "Change report status",
    exact: true,
  });

  await dropdown.focus();
  await page.keyboard.press("Enter");
  await expect(dropdown).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByRole("option", { name: "Pending", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await audit(page);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(dropdown).toHaveAttribute("data-value", "in progress");

  await dropdown.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await expect(dropdown).toHaveAttribute("aria-expanded", "false");
  await expect(dropdown).toBeFocused();

  const category = page.getByRole("combobox", {
    name: "Change report category",
    exact: true,
  });
  await page.setViewportSize({ width: 900, height: 520 });
  await category.click();
  const menu = page.getByRole("listbox", { name: "Change report category" });
  await expect(menu).toBeVisible();
  await expect(menu.locator("svg")).toHaveCount(0);
  const triggerBox = await category.boundingBox();
  const menuBox = await menu.boundingBox();
  expect(triggerBox).not.toBeNull();
  expect(menuBox).not.toBeNull();
  expect(menuBox!.width).toBeGreaterThanOrEqual(triggerBox!.width - 1);
  expect(menuBox!.x).toBeGreaterThanOrEqual(0);
  expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
  await expect(menu.getByRole("option", { name: "Road Damage" })).toBeInViewport();
  await expect(menu.getByRole("option", { name: "Others" })).toBeInViewport();
});

test("dropdown panel flips and scrolls within small viewports", async ({ page }, testInfo) => {
  await login(page);
  await page.goto("/admin/reports");
  await page.getByLabel("Search community reports").fill("Road surface");
  const trigger = page.getByRole("combobox", { name: "Change report category" });
  const wrapper = trigger.locator("..");
  const menu = page.getByRole("listbox", { name: "Change report category" });
  await page.setViewportSize({ width: 360, height: 640 });
  await page.locator(".report-card").evaluate((card) => {
    card.style.overflow = "hidden";
  });
  await wrapper.evaluate((element) => {
    element.style.cssText = "position:fixed;bottom:4px;right:3px;width:126px;z-index:1";
  });
  await trigger.click();
  await expectMenuInViewport(menu);
  await expect(menu).toHaveAttribute("data-placement", "top");
  await page.screenshot({ path: testInfo.outputPath("dropdown-panel-mobile.png") });
  expect((await menu.boundingBox())!.y + (await menu.boundingBox())!.height)
    .toBeLessThanOrEqual((await trigger.boundingBox())!.y);

  await page.keyboard.press("Escape");
  await wrapper.evaluate((element) => {
    element.style.cssText = "position:fixed;top:4px;left:3px;width:126px;z-index:1";
  });
  await trigger.click();
  await expectMenuInViewport(menu);
  await expect(menu).toHaveAttribute("data-placement", "bottom");

  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 320, height: 260 });
  await wrapper.evaluate((element) => {
    element.style.cssText = "position:fixed;bottom:4px;right:3px;width:126px;z-index:1";
  });
  await trigger.click();
  await expectMenuInViewport(menu);
  expect(await menu.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await page.keyboard.press("End");
  await expect(menu.getByRole("option", { name: "Others" })).toBeInViewport();
  await page.setViewportSize({ width: 420, height: 500 });
  await expectMenuInViewport(menu);
  await page.keyboard.press("Escape");
  await wrapper.evaluate((element) => {
    element.style.cssText = "position:fixed;top:4px;left:3px;width:126px;z-index:1";
  });
  await trigger.click();
  await expectMenuInViewport(menu);
  const device = await page.context().newCDPSession(page);
  await device.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1.5 });
  await expectMenuInViewport(menu);
  await device.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 });
  await device.detach();
});

test("dropdown follows its trigger in a scrolling card", async ({ page }) => {
  await login(page);
  await page.goto("/admin/reports");
  await page.getByLabel("Search community reports").fill("Road surface");
  const card = page.locator(".report-card");
  await card.evaluate((element) => {
    element.style.height = "135px";
    element.style.overflowY = "auto";
  });
  const trigger = card.getByRole("combobox", { name: "Change report category" });
  await trigger.click();
  const menu = page.getByRole("listbox", { name: "Change report category" });
  await expectMenuInViewport(menu);
  await expectMenuAnchored(trigger, menu);
  await card.evaluate((element) => {
    element.scrollTop = Math.max(0, element.scrollTop - 8);
  });
  await expectMenuAnchored(trigger, menu);
  await expectMenuInViewport(menu);
});

test("dropdowns stay visible in tables and a modal", async ({ page }) => {
  await login(page);
  await page.goto("/admin/staff");
  const staff = page.getByRole("combobox", { name: "Change role for Alex Reyes" });
  await staff.click();
  await expectMenuInViewport(page.getByRole("listbox", { name: "Change role for Alex Reyes" }));
  await page.keyboard.press("Escape");

  await page.goto("/admin/analytics");
  const year = page.getByRole("combobox", { name: "Select analytics year" });
  await year.click();
  await expectMenuInViewport(page.getByRole("listbox", { name: "Select analytics year" }));
  await page.keyboard.press("Escape");

  await page.goto("/admin/documents");
  await page.getByRole("button", { name: "View details", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  const status = dialog.getByRole("combobox", { name: "Update status" });
  await status.click();
  const statusMenu = page.getByRole("listbox", { name: "Update status" });
  await expectMenuInViewport(statusMenu);
  await expectMenuAnchored(status, statusMenu);
  await dialog.evaluate((element) => { element.scrollTop += 100; });
  await expectMenuInViewport(statusMenu);
  await expectMenuAnchored(status, statusMenu);
});

test("header search and notification panels fit a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 420 });
  await login(page);
  const search = page.getByRole("textbox", { name: "Search across the admin portal" });
  await search.fill("Road");
  const results = page.getByRole("region", { name: "Global search results" });
  await expectMenuInViewport(results);
  await page.setViewportSize({ width: 320, height: 260 });
  await expectMenuInViewport(results);

  await search.fill("");
  await page.getByRole("button", { name: "Open notifications" }).click();
  const notifications = page.getByRole("dialog", { name: "Notifications" });
  await expectMenuInViewport(notifications);
  await page.setViewportSize({ width: 360, height: 420 });
  await expectMenuInViewport(notifications);
});

test("resident review: evidence, accessible confirmation and approval", async ({
  page,
}) => {
  await login(page);
  await page.goto("/admin/residents");
  await page.getByLabel("Search resident accounts").fill("Maria Santos");
  await page.getByRole("button",{name:"View Maria Santos",exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Resident account details'});
  await expect(dialog.getByRole('button',{name:'Approve legacy registration'})).toBeEnabled();
  await dialog.getByText('Legacy registration details',{exact:true}).click();
  await expect(dialog.getByRole('img',{name:'ID front',exact:true})).toBeVisible();
  await audit(page);
  await dialog.getByRole('button',{name:'Approve legacy registration'}).click();
  await dialog.getByRole('button',{name:'Confirm',exact:true}).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('row').filter({hasText:'Maria Santos'})).toContainText('Active');
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
  await chooseDropdownOption(
    page,
    page,
    "Change role for Alex Reyes",
    "Staff",
  );
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
    .getByRole("link", { name: /^Document Requests/ })
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
  await chooseDropdownOption(page, dialog, "Update status", "Processing");
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

test('resident accounts separate phone ownership, audit access changes, and restrict staff',async({page})=>{
 await login(page);await page.goto('/admin/residents');
 await page.getByLabel('Search resident accounts').fill('Carlo Test');
 const row=page.getByRole('row').filter({hasText:'Carlo Test Resident'});
 await expect(row).toContainText('Active');await expect(row).toContainText('Not verified');
 await page.getByRole('button',{name:'View Carlo Test Resident'}).click();
 const dialog=page.getByRole('dialog',{name:'Resident account details'});
 await expect(dialog.getByRole('button',{name:'Suspend account'})).toBeEnabled();
 await expect(dialog.getByRole('button',{name:'Approve legacy registration'})).toHaveCount(0);
 await dialog.getByRole('button',{name:'Suspend account'}).click();
 await dialog.getByLabel('Reason',{exact:true}).fill('Synthetic account misuse review');
 await dialog.getByRole('button',{name:'Confirm',exact:true}).click();
 await expect(row).toContainText('Suspended');await expect(row).toContainText('Not verified');
 await page.getByRole('button',{name:'View Carlo Test Resident'}).click();
 await expect(dialog).toContainText('Synthetic account misuse review');
 await dialog.getByRole('button',{name:'Close',exact:true}).click();
 await login(page,'staff');await page.goto('/admin/residents');
 await page.getByRole('button',{name:'View Carlo Test Resident'}).click();
 await expect(dialog).toContainText('Synthetic account misuse review');
 await expect(dialog.getByRole('button',{name:'Reactivate account'})).toHaveCount(0);
 const response=await page.request.patch('/api/admin/residents/10000000-0000-4000-8000-000000000005/access',{data:{expectedState:'suspended',nextState:'active',reason:'Unauthorized staff attempt'}});
 expect(response.status()).toBe(403);
});

test('document detail sections avoid duplication and collapse review history',async({page})=>{
 await login(page);await page.goto('/admin/documents');
 await page.getByRole('button',{name:'View details',exact:true}).first().click();
 const dialog=page.getByRole('dialog',{name:'Document request details'});
 await expect(dialog.getByRole('button',{name:'Overview',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(dialog.getByText('resident0@example.test',{exact:true})).toHaveCount(0);
 await expect(dialog.getByText('Purok 3, Bancao-Bancao',{exact:true})).toHaveCount(1);
 await expect(dialog.getByRole('combobox',{name:'Update status'})).toBeHidden();
 await dialog.getByRole('button',{name:'Review',exact:true}).click();
 await expect(dialog.getByText('Not applicable — self-application')).toBeVisible();
 await chooseDropdownOption(page, dialog, 'Office payment decision', 'Paid at office');
 await dialog.getByLabel('Amount received at office').fill('50');
 await dialog.getByLabel('Official receipt reference').fill('TEST-RECEIPT');
 await chooseDropdownOption(page, dialog, 'Office payment decision', 'No fee required / authorized waiver');
 await expect(dialog.getByLabel('Official receipt reference')).toHaveCount(0);
 await dialog.getByLabel('Reason no fee applies').fill('Synthetic free service');
 await dialog.getByRole('button',{name:'Update request'}).click();
  await expect(dialog.getByRole('status')).toHaveText('Review details saved.');
  await expect(dialog.locator('.document-detail-content [role="status"]')).toHaveCount(0);
 await dialog.getByRole('button',{name:'History',exact:true}).click();
 await expect(dialog.locator('.document-history-entry')).toHaveCount(1);
 await expect(dialog.locator('.document-history-entry')).not.toHaveAttribute('open','');
 await dialog.locator('.document-history-entry summary').click();
 await expect(dialog.getByText('Recorded by Alex Reyes')).toBeVisible();
 await audit(page);
});

test('document dialog stays usable on a small phone and closed requests are read-only',async({page},testInfo)=>{
 await page.setViewportSize({width:390,height:700});
 await login(page);await page.goto('/admin/documents');
 await page.getByRole('button',{name:'View details',exact:true}).first().click();
 const dialog=page.getByRole('dialog',{name:'Document request details'});
 for(const section of ['Overview','Review','History']){
  await dialog.getByRole('button',{name:section,exact:true}).click();
  await expect(dialog.getByRole('button',{name:'Cancel',exact:true})).toBeVisible();
  expect(await dialog.evaluate(element=>element.scrollWidth<=element.clientWidth+1)).toBe(true);
  const buttonSizes=await dialog.locator('.document-detail-footer button').evaluateAll(buttons=>buttons.map(button=>({text:button.textContent,width:button.clientWidth,scroll:button.scrollWidth,right:button.getBoundingClientRect().right,parentRight:button.parentElement!.getBoundingClientRect().right})));
  expect(buttonSizes.every(b=>b.scroll<=b.width+1&&b.right<=b.parentRight)).toBe(true);
  await audit(page);
  await page.screenshot({path:testInfo.outputPath('document-'+section.toLowerCase()+'-390.png'),animations:'disabled'});
 }
 await dialog.getByRole('button',{name:'Review',exact:true}).click();
 await chooseDropdownOption(page,dialog,'Update status','Rejected');
 await dialog.getByLabel('Reason shown to the resident').fill('Synthetic missing requirement');
 await dialog.getByRole('button',{name:'Update request'}).click();
 await expect(dialog.getByText('This request is closed. Details and recorded reviews are read-only.')).toBeVisible();
 await expect(dialog.getByRole('button',{name:'Update request'})).toHaveCount(0);
 await expect(dialog.getByLabel('Office payment decision')).toHaveCount(0);
 await dialog.getByRole('button',{name:'Overview',exact:true}).click();
 await expect(dialog.getByText('Synthetic missing requirement',{exact:true})).toBeVisible();
 await page.screenshot({path:testInfo.outputPath('document-closed-390.png'),animations:'disabled'});
 await audit(page);
 await page.setViewportSize({width:1440,height:900});
 await page.screenshot({path:testInfo.outputPath('document-closed-1440.png'),animations:'disabled'});
 await audit(page);
});

test('interaction motion is short, settles at rest and respects reduced motion',async({page})=>{
 await login(page);await page.goto('/admin/documents');
 for(const preference of ['no-preference','reduce'] as const){
  await page.emulateMedia({reducedMotion:preference});
  await page.getByRole('button',{name:'View details',exact:true}).first().click();
  const dialog=page.getByRole('dialog',{name:'Document request details'});
  const motion=await dialog.evaluate(element=>({name:getComputedStyle(element).animationName,duration:getComputedStyle(element).animationDuration}));
  if(preference==='reduce')expect(motion.name).toBe('none');else{expect(motion.name).toBe('workspace-dialog-enter');expect(parseFloat(motion.duration)).toBeLessThanOrEqual(.2);}
  await dialog.getByRole('button',{name:'Review',exact:true}).click();
  await expect(dialog.getByLabel('Office payment decision')).toBeVisible();
  await dialog.evaluate(async()=>{await new Promise<void>(resolve=>setTimeout(resolve,240));});
  expect(await dialog.evaluate(element=>element.getAnimations({subtree:true}).filter(a=>a.playState==='running').length)).toBe(0);
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button',{name:'View details',exact:true}).first()).toBeFocused();
 }
});

test("document unread badges clear on opening details, persist, and isolate staff", async ({ page }) => {
  await login(page);
  const documentsLink = page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: /Document Requests/ });
  await expect(documentsLink.locator("em")).toHaveText("1");
  await page.getByRole("button", { name: "Open notifications" }).click();
  const notification = page.locator(".notification-item").filter({ hasText: "Document Requests" });
  await expect(notification).toContainText("1 unread item");
  await notification.click();
  await expect(page).toHaveURL(/\/admin\/documents/);
  await expect(documentsLink.locator("em")).toHaveText("1");
  await page.locator(".document-request-card").filter({ hasText: "Barangay Clearance" }).getByRole("button", { name: "View details", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Document request details" })).toBeVisible();
  await expect(documentsLink.locator("em")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Document requests", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation").getByRole("link", { name: /Community Reports/ }).locator("em")).toHaveText("2");
  await expect(documentsLink.locator("em")).toHaveCount(0);
  await expect(page.locator(".document-request-card").filter({ hasText: "Barangay Clearance" })).toContainText("Pending");
  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await login(page, "staff");
  await expect(documentsLink.locator("em")).toHaveText("1");
});

test("navigation shows the destination skeleton while data is loading", async ({ page }) => {
  await login(page);
  let release!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/rest/v1/document_requests*", async route => {
    if (new URL(route.request().url()).searchParams.get("select") !== "*") return route.continue();
    await waiting;
    await route.continue();
  });
  try {
    const navigation = page.getByRole("navigation", { name: "Main navigation" });
    await navigation.getByRole("link", { name: /Document Requests/ }).click();
    await expect(navigation.getByRole("link", { name: /Document Requests/ })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { level: 1, name: "Document requests", exact: true })).toBeVisible();
    await expect(page.locator(".page-skeleton")).toBeVisible();
    await expect(page.getByRole("button", { name: "Open notifications" })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator(".page-skeleton")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: "test-results/document-loading-390.png" });
  } finally {
    release();
  }
  await expect(page.locator(".page-skeleton")).toHaveCount(0);
  await expect(page.getByText("Maria Santos", { exact: true }).first()).toBeVisible();
});


test("opening the review pane never submits a document update", async ({ page }) => {
  await login(page);
  await page.goto("/admin/documents");
  await page.getByRole("button", { name: "View details", exact: true }).first().click();
  let updates = 0;
  page.on("request", request => {
    if (request.method() === "PATCH" && request.url().includes("/api/admin/document-requests/")) updates++;
  });
  const dialog = page.getByRole("dialog", { name: "Document request details" });
  await dialog.getByRole("button", { name: "Review request", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Update request", exact: true })).toBeEnabled();
  await expect(dialog.locator(".document-request-current")).toContainText("Pending");
  await dialog.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Review request", exact: true })).toBeVisible();
  expect(updates).toBe(0);
});


test("private evidence refreshes expired links on every opening and denies fail closed", async ({ page }) => {
  let signs = 0;
  let deny = false;
  const expiredLoads: string[] = [];
  page.on('request', request => {
    if (request.method() === 'GET' && request.url().includes('token=expired')) expiredLoads.push(request.url());
  });
  await page.route('**/rest/v1/document_requests*', async route => {
    const response = await route.fetch();
    if (new URL(route.request().url()).searchParams.get('select') !== '*') return route.fulfill({ response });
    const rows = await response.json();
    return route.fulfill({ response, json: rows.map((row: object, index: number) => index === 0 ? { ...row,
      requester_capacity: 'representative', identity_evidence_method: 'upload', residency_evidence_method: 'upload', authorization_evidence_method: 'upload',
      identity_evidence_url: origin+'/storage/v1/object/sign/resident-files/owner/identity.png?token=expired',
      residency_evidence_url: origin+'/storage/v1/object/sign/resident-files/owner/residency.png?token=expired',
      authorization_evidence_url: origin+'/storage/v1/object/sign/resident-files/owner/authorization.png?token=expired',
    } : row) });
  });
  await page.route('**/storage/v1/object/sign/resident-files/**', async route => {
    if (route.request().method() === 'POST') {
      signs++;
      return route.fulfill({ status: deny ? 403 : 200, json: deny ? { message: 'Access denied' } : { signedURL: '/object/sign/resident-files/owner/preview.png?token=fresh-'+signs } });
    }
    return route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64') });
  });
  await login(page);
  await page.goto('/admin/documents');
  await page.getByRole('button', { name: 'View details', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Document request details' });
  await dialog.getByRole('button', { name: 'Review request', exact: true }).click();
  expect(signs).toBe(0);
  for (const kind of ['identity', 'residency', 'authorization', 'identity']) {
    await dialog.getByRole('button', { name: 'Open '+kind+' evidence', exact: true }).click();
    const preview = page.getByRole('dialog', { name: kind[0].toUpperCase()+kind.slice(1)+' evidence', exact: true });
    await expect(preview).toBeVisible();
    const image = preview.locator('img');
    await expect(image).toHaveAttribute('src', /token=fresh-/);
    await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
    await expect(preview.getByRole('link', { name: 'Open original' })).toHaveCount(0);
    await preview.getByRole('button', { name: 'Close image viewer' }).click();
  }
  expect(signs).toBe(4);
  deny = true;
  await dialog.getByRole('button', { name: 'Open identity evidence', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Evidence could not be opened');
  await expect(page.getByRole('dialog', { name: 'Identity evidence', exact: true })).toHaveCount(0);
  expect(expiredLoads).toEqual([]);
});

test("office payment dropdown fits the review dialog and supports keyboard selection", async ({ page }) => {
  await login(page);
  await page.goto('/admin/documents');
  await page.getByRole('button', { name: 'View details', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Document request details' });
  await dialog.getByRole('button', { name: 'Review request', exact: true }).click();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const trigger = dialog.getByRole('combobox', { name: 'Office payment decision', exact: true });
    await trigger.click();
    const menu = page.getByRole('listbox', { name: 'Office payment decision', exact: true });
    await expectMenuInViewport(menu);
    await expect.poll(async () => {
      const field = await trigger.boundingBox();
      const panel = await menu.boundingBox();
      return !!field && !!panel && panel.y >= field.y + field.height;
    }).toBe(true);
    await expect.poll(() => menu.evaluate(element => getComputedStyle(element).opacity)).toBe('1');
    expect(await menu.evaluate(element => element.scrollHeight <= element.clientHeight + 1)).toBe(true);
    await page.screenshot({ path: 'test-results/office-payment-menu-'+width+'.png' });
    await trigger.press('Escape');
  }
  const paymentTrigger = dialog.getByRole('combobox', { name: 'Office payment decision', exact: true });
  await paymentTrigger.press('ArrowDown');
  await paymentTrigger.press('End');
  await paymentTrigger.press('Enter');
  await expect(dialog.getByLabel('Reason no fee applies')).toBeVisible();
  await dialog.getByLabel('Reason no fee applies').fill('Synthetic free service');
  await expect(dialog.locator('.document-status-preview')).toBeEmpty();
  await chooseDropdownOption(page, dialog, 'Update status', 'Processing');
  await expect(dialog.locator('.document-status-preview')).toHaveText('Saving will change the status to Processing.');
  await dialog.getByRole('button', { name: 'Update request', exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText('Request updated to Processing.');
  await expect(dialog.locator('.document-status-preview')).toBeEmpty();
});
