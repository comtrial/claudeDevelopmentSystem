import { defineConfig, devices } from "@playwright/test";
import path from "path";

const STORAGE_STATE = path.join(__dirname, "e2e/.auth/user.json");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "e2e/reports" }],
  ],
  use: {
    baseURL:
      process.env.BASE_URL || "https://claude-dev-system.vercel.app",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    // 인증 세션 준비 (setup)
    {
      name: "setup",
      testMatch: /global\.setup\.ts/,
    },
    // 미인증 상태 테스트
    {
      name: "unauthenticated",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /unauthenticated\/.+\.spec\.ts/,
    },
    // 인증 상태 테스트 (setup 의존)
    {
      name: "authenticated",
      use: {
        ...devices["Desktop Chrome"],
        storageState: STORAGE_STATE,
      },
      dependencies: ["setup"],
      testMatch: /\/authenticated\/.+\.spec\.ts/,
    },
    // 공통 테스트 (인증 무관)
    {
      name: "common",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /common\/.+\.spec\.ts/,
    },
  ],
});
