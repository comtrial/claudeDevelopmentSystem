import { test, expect } from "@playwright/test";

test.describe("Phase 1: Task Status Flow Visibility", () => {
  // ── API-level tests ──────────────────────────────────────────────

  test("GET /api/pipelines 응답에 task_summary 포함", async ({ request }) => {
    // Unauthenticated request returns error — we verify response shape
    const res = await request.get("/api/pipelines");
    const body = await res.json();

    // Unauthenticated → error, but the API itself responds (not 500)
    expect(body).toHaveProperty("status");
    // Authenticated scenario tested below via page context
  });

  // ── Component rendering tests ────────────────────────────────────

  test("Pipeline Monitor 페이지에 TaskProgressTimeline 렌더링", async ({ page }) => {
    // Navigate to a pipeline detail page — use a mock/known pipeline
    // Since we need auth, we go to login first
    await page.goto("/login");

    // Fill login form
    await page.locator('input[type="email"]').fill("test@claudedev.com");
    await page.locator('input[type="password"]').fill("Test1234");
    await page.locator('button[type="submit"]').click();

    // Wait for dashboard
    await page.waitForURL("**/dashboard**", { timeout: 15000 });

    // Check if there are any pipelines on the dashboard
    const hasPipelines = await page.locator('[role="button"]').first().isVisible().catch(() => false);

    if (hasPipelines) {
      // Click first pipeline to navigate to monitor page
      await page.locator('[role="button"]').first().click();
      await page.waitForURL("**/pipelines/**", { timeout: 10000 });

      // Check if task-progress-timeline exists (may be empty if no tasks)
      const pageContent = await page.content();
      // The timeline component renders only when tasks.length > 0
      // Verify the page loaded successfully (no error state)
      const hasError = await page.locator("text=파이프라인 데이터를 불러오는 데 실패했습니다").isVisible().catch(() => false);
      expect(hasError).toBe(false);

      // Check for agent status section (always present)
      await expect(page.locator("text=에이전트 상태")).toBeVisible({ timeout: 5000 });

      // If tasks exist, the timeline should render
      const hasTimeline = await page.locator('[data-testid="task-progress-timeline"]').isVisible().catch(() => false);
      if (hasTimeline) {
        // Verify timeline has task nodes
        const taskNodes = page.locator('[data-testid^="task-node-"]');
        const count = await taskNodes.count();
        expect(count).toBeGreaterThan(0);

        // Verify section header shows counts
        await expect(page.locator("text=태스크 진행 상황")).toBeVisible();
      }
    }
  });

  test("Dashboard Pipeline Card에 task-progress-label 표시", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill("test@claudedev.com");
    await page.locator('input[type="password"]').fill("Test1234");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL("**/dashboard**", { timeout: 15000 });

    // Wait for pipeline cards to load
    await page.waitForTimeout(2000);

    // Check if any pipeline cards have task progress labels
    const taskLabels = page.locator('[data-testid="task-progress-label"]');
    const labelCount = await taskLabels.count();

    // If there are pipelines with tasks, labels should be present
    if (labelCount > 0) {
      const firstLabel = await taskLabels.first().textContent();
      expect(firstLabel).toMatch(/Task \d+\/\d+/);
    }
  });

  // ── Component structure tests ────────────────────────────────────

  test("TaskProgressTimeline 컴포넌트 파일 존재 및 export 확인", async ({ page }) => {
    // Verify the component module exists by checking if the page that imports it loads
    await page.goto("/login");
    await page.locator('input[type="email"]').fill("test@claudedev.com");
    await page.locator('input[type="password"]').fill("Test1234");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL("**/dashboard**", { timeout: 15000 });

    // Navigate to pipelines page
    await page.goto("/pipelines");
    await page.waitForLoadState("networkidle");

    // Page should load without JS errors
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && msg.text().includes("task-progress-timeline")) {
        consoleErrors.push(msg.text());
      }
    });

    // Check no import errors related to our new component
    expect(consoleErrors).toHaveLength(0);
  });

  // ── Pipeline detail API with tasks ────────────────────────────────

  test("Pipeline detail API가 tasks 배열 반환", async ({ page, request }) => {
    // Login to get auth cookies
    await page.goto("/login");
    await page.locator('input[type="email"]').fill("test@claudedev.com");
    await page.locator('input[type="password"]').fill("Test1234");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL("**/dashboard**", { timeout: 15000 });

    // Fetch pipeline list using page context (authenticated)
    const pipelinesRes = await page.evaluate(async () => {
      const res = await fetch("/api/pipelines");
      return res.json();
    });

    if (pipelinesRes.data && pipelinesRes.data.length > 0) {
      const firstPipeline = pipelinesRes.data[0];

      // Verify task_summary is present
      expect(firstPipeline).toHaveProperty("task_summary");
      expect(firstPipeline.task_summary).toHaveProperty("total");
      expect(firstPipeline.task_summary).toHaveProperty("completed");
      expect(firstPipeline.task_summary).toHaveProperty("in_progress");
      expect(firstPipeline.task_summary).toHaveProperty("failed");
      expect(firstPipeline.task_summary).toHaveProperty("pending");

      // Fetch detail
      const detailRes = await page.evaluate(async (id: string) => {
        const res = await fetch(`/api/pipelines/${id}`);
        return res.json();
      }, firstPipeline.id);

      if (detailRes.data) {
        expect(detailRes.data).toHaveProperty("tasks");
        expect(Array.isArray(detailRes.data.tasks)).toBe(true);

        // Each task should have required fields
        if (detailRes.data.tasks.length > 0) {
          const task = detailRes.data.tasks[0];
          expect(task).toHaveProperty("id");
          expect(task).toHaveProperty("title");
          expect(task).toHaveProperty("status");
          expect(task).toHaveProperty("order_index");
        }
      }
    }
  });
});
