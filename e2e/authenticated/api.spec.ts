import { test, expect } from "@playwright/test";

test.describe("인증된 API 요청", () => {
  test("GET /api/pipelines → 200 + 표준 응답 형식", async ({ page }) => {
    await page.goto("/dashboard");
    const response = await page.evaluate(async () => {
      const res = await fetch("/api/pipelines");
      return { status: res.status, body: await res.json() };
    });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).not.toBeNull();
  });

  test("GET /api/settings → 200", async ({ page }) => {
    await page.goto("/dashboard");
    const response = await page.evaluate(async () => {
      const res = await fetch("/api/settings");
      return { status: res.status, body: await res.json() };
    });

    expect(response.status).toBe(200);
  });

  test("GET /api/history → 200", async ({ page }) => {
    await page.goto("/dashboard");
    const response = await page.evaluate(async () => {
      const res = await fetch("/api/history");
      return { status: res.status, body: await res.json() };
    });

    expect(response.status).toBe(200);
  });
});
