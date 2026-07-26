import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());
const port = Number(process.env.PLAYWRIGHT_PORT ?? 3001);
const baseURL = process.env.CRM_BASE_URL ?? `http://127.0.0.1:${port}`;
const authSecret = process.env.AUTH_SECRET ?? "playwright-local-auth-secret";

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    storageState: ".playwright/auth.json",
    launchOptions: process.env.PLAYWRIGHT_CHROME_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROME_PATH }
      : undefined,
    trace: "on-first-retry",
    screenshot: "only-on-failure"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  webServer: process.env.PLAYWRIGHT_EXTERNAL_SERVER
    ? undefined
    : {
        command: `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
        url: `${baseURL}/auth/signed-out`,
        env: { ...process.env, AUTH_SECRET: authSecret },
        reuseExistingServer: !process.env.CI,
        timeout: 120_000
      }
});
