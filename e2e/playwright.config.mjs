import { defineConfig, devices } from "@playwright/test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
if (!process.env.E2E_DB_PATH) {
  throw new Error("Execute 'npm --prefix e2e test': os testes precisam de um banco temporario.");
}

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.mjs",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    acceptDownloads: true
  },
  webServer: [
    {
      command: "npm --prefix backend start",
      cwd: root,
      url: "http://127.0.0.1:3000/api/health",
      env: { MEU_PONTO_DB_PATH: process.env.E2E_DB_PATH },
      reuseExistingServer: false,
      timeout: 45_000
    },
    {
      command: "npm run dev -- --host 127.0.0.1",
      cwd: root,
      url: "http://127.0.0.1:5173",
      reuseExistingServer: false,
      timeout: 45_000
    }
  ]
});
