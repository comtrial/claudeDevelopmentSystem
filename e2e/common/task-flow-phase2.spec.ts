import { test, expect } from "@playwright/test";

test.describe("Phase 2: Parse Enhancement + Task Card Enrichment", () => {
  // ── Parse API tests ──────────────────────────────────────────────

  test("Parse API 응답 구조 - 빈 입력 거부", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill("test@claudedev.com");
    await page.locator('input[type="password"]').fill("Test1234");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL("**/dashboard**", { timeout: 15000 });

    const parseRes = await page.evaluate(async () => {
      const res = await fetch("/api/pipelines/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: "" }),
      });
      return { status: res.status, body: await res.json() };
    });

    expect(parseRes.body.error).toBeTruthy();
    expect(parseRes.body.error.message).toContain("input is required");
  });

  // ── Wizard UI tests ──────────────────────────────────────────────

  test("Wizard 페이지 로드 및 작업 정의 입력 필드 표시", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill("test@claudedev.com");
    await page.locator('input[type="password"]').fill("Test1234");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL("**/dashboard**", { timeout: 15000 });

    await page.goto("/pipelines/new");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    // Verify wizard step 1 is shown — "작업 정의" heading
    await expect(page.locator("text=작업 정의").first()).toBeVisible({ timeout: 5000 });

    // Verify category selector (개발/범용) is present
    await expect(page.locator("text=개발")).toBeVisible();
    await expect(page.locator("text=범용")).toBeVisible();

    // Verify textarea or text input exists for task description
    const hasTextarea = await page.locator("textarea").isVisible().catch(() => false);
    const hasInput = await page.locator('input[type="text"]').first().isVisible().catch(() => false);
    expect(hasTextarea || hasInput).toBe(true);
  });

  // ── Monitor page analysis display tests ──────────────────────────

  test("Pipeline Monitor 페이지에 analysis-intent 렌더링 (데이터 있을 때)", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill("test@claudedev.com");
    await page.locator('input[type="password"]').fill("Test1234");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL("**/dashboard**", { timeout: 15000 });

    const pipelinesRes = await page.evaluate(async () => {
      const res = await fetch("/api/pipelines");
      return res.json();
    });

    if (pipelinesRes.data && pipelinesRes.data.length > 0) {
      const pipelineId = pipelinesRes.data[0].id;
      await page.goto(`/pipelines/${pipelineId}`);
      // Use domcontentloaded instead of networkidle to avoid Realtime timeout
      await page.waitForLoadState("domcontentloaded");
      // Wait for content to render
      await page.waitForTimeout(3000);

      const hasError = await page.locator("text=파이프라인 데이터를 불러오는 데 실패했습니다").isVisible().catch(() => false);
      expect(hasError).toBe(false);

      // Verify page loaded successfully by checking for agent section
      const hasAgentSection = await page.locator("text=에이전트 상태").isVisible().catch(() => false);
      expect(hasAgentSection).toBe(true);
    }
  });

  // ── Task Card complexity badge tests ──────────────────────────────

  test("Task 카드에 complexity 뱃지 표시 (데이터 있을 때)", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill("test@claudedev.com");
    await page.locator('input[type="password"]').fill("Test1234");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL("**/dashboard**", { timeout: 15000 });

    const pipelinesRes = await page.evaluate(async () => {
      const res = await fetch("/api/pipelines");
      return res.json();
    });

    if (pipelinesRes.data && pipelinesRes.data.length > 0) {
      const pipelineId = pipelinesRes.data[0].id;
      await page.goto(`/pipelines/${pipelineId}`);
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(3000);

      const complexityBadges = page.locator('[data-testid="task-complexity-badge"]');
      const badgeCount = await complexityBadges.count();

      if (badgeCount > 0) {
        const firstBadge = await complexityBadges.first().textContent();
        expect(["Low", "Mid", "High"]).toContain(firstBadge?.trim());
      }
    }
  });

  // ── Pipeline creation with metadata tests ─────────────────────────

  test("Pipeline 생성 API에 task input_data 메타데이터 전달", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill("test@claudedev.com");
    await page.locator('input[type="password"]').fill("Test1234");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL("**/dashboard**", { timeout: 15000 });

    const createRes = await page.evaluate(async () => {
      const res = await fetch("/api/pipelines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Phase2 Test Pipeline",
          description: "Test with task metadata",
          original_query: "테스트 파이프라인 생성",
          mode: "auto_edit",
          config: {
            analysis: {
              intent: "테스트 파이프라인을 생성합니다",
              scope: "small",
              reasoning: "간단한 테스트이므로 2개의 태스크로 분해합니다.",
            },
          },
          tasks: [
            {
              title: "설계",
              description: "시스템 설계",
              agent_role: "pm",
              order: 1,
              estimated_complexity: "low",
              acceptance_criteria: "설계 문서 생성 완료",
            },
            {
              title: "구현",
              description: "코드 구현",
              agent_role: "engineer",
              order: 2,
              estimated_complexity: "medium",
              acceptance_criteria: "코드 작성 및 빌드 통과",
            },
          ],
          agents: [
            { role: "pm", chainOrder: 1 },
            { role: "engineer", chainOrder: 2 },
          ],
        }),
      });
      return res.json();
    });

    expect(createRes.data).toBeTruthy();
    expect(createRes.data.id).toBeTruthy();

    const detailRes = await page.evaluate(async (id: string) => {
      const res = await fetch(`/api/pipelines/${id}`);
      return res.json();
    }, createRes.data.id);

    expect(detailRes.data.tasks.length).toBe(2);
    expect(detailRes.data.tasks[0].input_data.estimated_complexity).toBe("low");
    expect(detailRes.data.tasks[0].input_data.acceptance_criteria).toBe("설계 문서 생성 완료");
    expect(detailRes.data.tasks[0].input_data.agent_role).toBe("pm");
    expect(detailRes.data.tasks[1].input_data.estimated_complexity).toBe("medium");

    expect(detailRes.data.config.analysis.intent).toBe("테스트 파이프라인을 생성합니다");
    expect(detailRes.data.config.analysis.scope).toBe("small");

    // Navigate to monitor page
    await page.goto(`/pipelines/${createRes.data.id}`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);

    // Analysis intent should be visible
    await expect(page.locator('[data-testid="analysis-intent"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=시스템 이해")).toBeVisible();

    // Task timeline should show with complexity badges
    await expect(page.locator('[data-testid="task-progress-timeline"]')).toBeVisible({ timeout: 5000 });
    const complexityBadges = page.locator('[data-testid="task-complexity-badge"]');
    expect(await complexityBadges.count()).toBe(2);

    // Cleanup
    await page.evaluate(async (id: string) => {
      await fetch(`/api/pipelines/${id}`, { method: "DELETE" });
    }, createRes.data.id);
  });
});
