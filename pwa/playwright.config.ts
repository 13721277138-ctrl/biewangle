import { defineConfig, devices } from "@playwright/test";

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;
const localBaseURL = new URL(process.env.VITE_BASE_PATH || "/", "http://127.0.0.1:4173/").href;
const baseURL = externalBaseURL ?? localBaseURL;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: baseURL.endsWith("/") ? baseURL : `${baseURL}/`,
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome",
      },
    },
  ],
  webServer: externalBaseURL
    ? undefined
    : {
        command: "pnpm preview",
        url: localBaseURL,
        reuseExistingServer: true,
        timeout: 30_000,
      },
});
