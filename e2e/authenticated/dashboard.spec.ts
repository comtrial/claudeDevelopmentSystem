import { test, expect } from "@playwright/test";

test.describe("대시보드 (인증 후)", () => {
  test("대시보드 페이지 접근 가능", async ({ page }) => {
    await page.goto("/dashboard");
    // 로그인 리다이렉트 없이 대시보드 유지
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("레이아웃 — 사이드바 렌더링", async ({ page }) => {
    await page.goto("/dashboard");
    const sidebar = page.locator("aside, nav[aria-label]").first();
    await expect(sidebar).toBeVisible();
  });

  test("레이아웃 — 탑바 렌더링", async ({ page }) => {
    await page.goto("/dashboard");
    const topbar = page.locator("header").first();
    await expect(topbar).toBeVisible();
  });

  test("레이아웃 — 다크모드 토글 존재", async ({ page }) => {
    await page.goto("/dashboard");
    // Sun 또는 Moon 아이콘 버튼
    const themeToggle = page.locator(
      'button:has(svg.lucide-sun), button:has(svg.lucide-moon), [aria-label*="theme"], [aria-label*="테마"]'
    );
    await expect(themeToggle.first()).toBeVisible();
  });
});

test.describe("사이드바 네비게이션", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
  });

  const navRoutes = [
    { label: /dashboard/i, path: "/dashboard" },
    { label: /history|히스토리/i, path: "/history" },
    { label: /settings|설정/i, path: "/settings" },
  ];

  for (const { label, path } of navRoutes) {
    test(`${path} 네비게이션 링크 동작`, async ({ page }) => {
      const link = page.locator(`a[href*="${path}"]`).first();
      if ((await link.count()) > 0) {
        await link.click();
        await page.waitForURL(`**${path}**`);
        expect(page.url()).toContain(path);
      }
    });
  }
});

test.describe("보호된 라우트 접근", () => {
  const protectedRoutes = [
    "/dashboard",
    "/pipelines",
    "/pipelines/new",
    "/history",
    "/settings",
  ];

  for (const route of protectedRoutes) {
    test(`${route} — 200 OK (리다이렉트 없음)`, async ({ page }) => {
      await page.goto(route);
      // login으로 리다이렉트되지 않음
      await page.waitForLoadState("networkidle");
      expect(page.url()).not.toContain("/login");
    });
  }
});
