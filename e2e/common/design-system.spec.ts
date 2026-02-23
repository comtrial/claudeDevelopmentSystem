import { test, expect } from "@playwright/test";

test.describe("디자인 시스템 토큰", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("기본 CSS 변수 (background, foreground)", async ({ page }) => {
    const hasCSSVars = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return (
        style.getPropertyValue("--background").trim().length > 0 &&
        style.getPropertyValue("--foreground").trim().length > 0
      );
    });
    expect(hasCSSVars).toBe(true);
  });

  test("상태 색상 토큰 6종", async ({ page }) => {
    const tokens = [
      "--healthy",
      "--warning",
      "--danger",
      "--critical",
      "--idle",
      "--running",
    ];
    const allExist = await page.evaluate((tks) => {
      const style = getComputedStyle(document.documentElement);
      return tks.every(
        (t) => style.getPropertyValue(t).trim().length > 0
      );
    }, tokens);
    expect(allExist).toBe(true);
  });

  test("에이전트 색상 토큰 3종 이상", async ({ page }) => {
    const tokens = ["--agent-pm", "--agent-engineer", "--agent-reviewer"];
    const allExist = await page.evaluate((tks) => {
      const style = getComputedStyle(document.documentElement);
      return tks.every(
        (t) => style.getPropertyValue(t).trim().length > 0
      );
    }, tokens);
    expect(allExist).toBe(true);
  });
});

test.describe("테마 시스템", () => {
  test("HTML class 기반 테마 전략", async ({ page }) => {
    await page.goto("/login");
    const classAttr = await page.locator("html").getAttribute("class");
    expect(classAttr).not.toBeNull();
  });
});

test.describe("폰트", () => {
  test("next/font 커스텀 폰트 적용", async ({ page }) => {
    await page.goto("/login");
    const hasFontVar = await page.evaluate(() => {
      const bodyClass = document.body.className;
      const htmlClass = document.documentElement.className;
      const fontFamily = getComputedStyle(document.body).fontFamily;
      return (
        bodyClass.includes("__") ||
        htmlClass.includes("__") ||
        fontFamily.includes("Inter") ||
        fontFamily.includes("__")
      );
    });
    expect(hasFontVar).toBe(true);
  });
});

test.describe("접근성 기본", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("html lang 속성", async ({ page }) => {
    const lang = await page.locator("html").getAttribute("lang");
    expect(lang).toBeTruthy();
  });

  test("viewport meta 태그", async ({ page }) => {
    await expect(page.locator('meta[name="viewport"]')).toHaveCount(1);
  });

  test("label 요소 존재 (input 연관)", async ({ page }) => {
    const labelCount = await page.locator("label").count();
    expect(labelCount).toBeGreaterThanOrEqual(2);
  });
});

test.describe("정적 페이지 응답", () => {
  test("GET /login → 200", async ({ request }) => {
    expect((await request.get("/login")).status()).toBe(200);
  });

  test("GET /signup → 200", async ({ request }) => {
    expect((await request.get("/signup")).status()).toBe(200);
  });
});

test.describe("API 응답 형식", () => {
  test("에러 응답 표준 포맷 { data, error, status }", async ({
    request,
  }) => {
    const body = await (await request.get("/api/pipelines")).json();
    expect(body).toHaveProperty("error");
    expect(body.error).toHaveProperty("message");
    expect(body.error).toHaveProperty("code");
    expect(body).toHaveProperty("status");
    expect(body.data).toBeNull();
  });
});

test.describe("네비게이션", () => {
  test("로그인 ↔ 회원가입 페이지 왕복", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('input[type="email"]')).toBeVisible();

    await page.locator('a[href*="signup"]').click();
    await page.waitForURL("**/signup**");

    await page.locator('a[href*="login"]').click();
    await page.waitForURL("**/login**");
  });
});
