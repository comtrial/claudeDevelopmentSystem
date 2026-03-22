import { test, expect } from "@playwright/test";

test.describe("로그인 페이지", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.waitForURL("**/login**");
  });

  test("폼 요소 렌더링 (email, password, submit)", async ({ page }) => {
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("회원가입 링크 존재", async ({ page }) => {
    await expect(page.locator('a[href*="signup"]')).toBeVisible();
  });

  test("빈 폼 제출 시 브라우저 validation 동작", async ({ page }) => {
    await page.locator('button[type="submit"]').click();
    const isInvalid = await page
      .locator('input[type="email"]')
      .evaluate((el: HTMLInputElement) => !el.validity.valid);
    expect(isInvalid).toBe(true);
  });

  test("잘못된 자격증명 → 에러 메시지 표시", async ({ page }) => {
    await page.locator('input[type="email"]').fill("invalid@test.com");
    await page.locator('input[type="password"]').fill("wrongpassword123");
    await page.locator('button[type="submit"]').click();

    const errorElement = page.locator(
      '[role="alert"], .text-destructive, [data-error]'
    );
    await expect(errorElement).toBeVisible({ timeout: 10000 });
  });

  test("로그인 성공 → /dashboard 리다이렉트", async ({ page }) => {
    await page.locator('input[type="email"]').fill("test@claudedev.com");
    await page.locator('input[type="password"]').fill("Test1234");
    await page.locator('button[type="submit"]').click();

    await page.waitForURL("**/dashboard**", { timeout: 15000 });
    expect(page.url()).toContain("/dashboard");
  });
});

test.describe("회원가입 페이지", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/signup");
  });

  test("폼 요소 렌더링", async ({ page }) => {
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("로그인 링크 존재", async ({ page }) => {
    await expect(page.locator('a[href*="login"]')).toBeVisible();
  });
});
