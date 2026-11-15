import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const port = 4320;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  projects: [
    {
      name: "desktop-edge",
      use: {
        ...devices["Desktop Chrome"],
        channel: "msedge",
        viewport: { width: 1280, height: 820 }
      }
    }
  ],
  webServer: {
    command: "npm run e2e:serve",
    url: `http://127.0.0.1:${port}/api/health`,
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      PORT: String(port),
      APP_DATA_DIR: path.resolve("test-results/e2e-data"),
      NO_OPEN: "1"
    }
  }
});
