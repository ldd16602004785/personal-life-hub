import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/desktop",
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { outputFolder: "playwright-report/desktop", open: "never" }]],
  use: {
    trace: "retain-on-failure"
  }
});
