import { defineConfig } from "@playwright/test";

// Pure service tests: no browser, build, database, or hosted credentials required.
export default defineConfig({
  testDir: "./tests",
  testMatch: ["private-files.spec.ts", "document-workflow.spec.ts", "resident-state.spec.ts", "notification-read-state.spec.ts"],
  reporter: "list",
});
