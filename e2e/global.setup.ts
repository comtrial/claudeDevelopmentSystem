import { test as setup, expect } from "@playwright/test";
import path from "path";

const STORAGE_STATE = path.join(__dirname, ".auth/user.json");

setup("authenticate test user", async ({ page }) => {
  // 로그인 페이지 이동
  await page.goto("/login");
  await page.waitForURL("**/login**");

  // 테스트 계정으로 로그인
  await page.locator('input[type="email"]').fill("test@claudedev.com");
  await page.locator('input[type="password"]').fill("Test1234");
  await page.locator('button[type="submit"]').click();

  // 대시보드로 리다이렉트 대기
  await page.waitForURL("**/dashboard**", { timeout: 15000 });
  expect(page.url()).toContain("/dashboard");

  // 인증 세션 저장 (쿠키 + localStorage)
  await page.context().storageState({ path: STORAGE_STATE });
});
