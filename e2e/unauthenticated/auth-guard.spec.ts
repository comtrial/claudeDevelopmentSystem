import { test, expect } from "@playwright/test";

test.describe("미들웨어 인증 가드", () => {
  const protectedRoutes = [
    "/dashboard",
    "/pipelines",
    "/pipelines/new",
    "/settings",
    "/history",
  ];

  for (const route of protectedRoutes) {
    test(`${route} → /login 리다이렉트`, async ({ page }) => {
      await page.goto(route);
      await page.waitForURL("**/login**");
      expect(page.url()).toContain("/login");
    });
  }

  test("/ (루트) → /login 리다이렉트", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL("**/login**");
    expect(page.url()).toContain("/login");
  });
});

test.describe("API 인증 가드", () => {
  const getEndpoints = [
    "/api/pipelines",
    "/api/settings",
    "/api/history",
    "/api/sessions/fake-id",
  ];

  for (const endpoint of getEndpoints) {
    test(`GET ${endpoint} → 401`, async ({ request }) => {
      const response = await request.get(endpoint);
      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe("UNAUTHORIZED");
    });
  }

  const postEndpoints = [
    { path: "/api/pipelines", data: { title: "test" } },
    { path: "/api/pipelines/parse", data: { text: "test" } },
    { path: "/api/settings/test-key", data: { key: "test" } },
  ];

  for (const { path, data } of postEndpoints) {
    test(`POST ${path} → 401`, async ({ request }) => {
      const response = await request.post(path, { data });
      expect(response.status()).toBe(401);
    });
  }

  test("PATCH /api/settings → 401", async ({ request }) => {
    const response = await request.patch("/api/settings", {
      data: { theme: "dark" },
    });
    expect(response.status()).toBe(401);
  });
});
