import { test, expect } from "@playwright/test";

/**
 * Notion Page Selector E2E Tests
 *
 * Tests the Notion page input source feature in the pipeline creation wizard:
 * - Input source tab switching (direct / Notion)
 * - Notion page list loading, search, and selection
 * - Page preview and content confirmation
 * - Error handling and retry
 * - Integration with the analyze flow
 */

const mockPages = {
  data: {
    pages: [
      {
        id: "page-001",
        title: "로그인 기능 기획서",
        icon: "📄",
        last_edited: new Date().toISOString(),
        has_children: false,
      },
      {
        id: "page-002",
        title: "결제 시스템 설계",
        icon: "💳",
        last_edited: new Date().toISOString(),
        has_children: true,
      },
      {
        id: "page-003",
        title: "API 리팩토링 계획",
        icon: "🔧",
        last_edited: new Date().toISOString(),
        has_children: false,
      },
    ],
    root_page_id: "root-123",
    root_page_title: "Claude Dev System",
  },
};

const mockPageContent = {
  data: {
    id: "page-001",
    title: "로그인 기능 기획서",
    content:
      "## 목표\n로그인 기능을 구현한다.\n\n## 요구사항\n- 이메일/비밀번호 입력\n- 유효성 검증\n- 에러 메시지 표시\n\n## 기술 스택\n- Supabase Auth\n- shadcn/ui Form",
    last_edited: new Date().toISOString(),
    word_count: 45,
  },
};

/** Shared login helper for common tests (no storageState dependency) */
async function loginAndNavigateToWizard(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill("test@claudedev.com");
  await page.locator('input[type="password"]').fill("Test1234");
  await page.locator('button[type="submit"]').click();
  await page.waitForURL("**/dashboard**", { timeout: 15000 });

  await page.goto("/pipelines/new");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);
}

test.describe("Notion 페이지 선택기", () => {
  test.setTimeout(120000);

  // ── Test 1: Input source selector renders with two tabs ──────────

  test("입력 소스 선택기가 직접입력/Notion 탭으로 렌더링됨", async ({ page }) => {
    await loginAndNavigateToWizard(page);

    // Verify "입력 방식" label exists
    await expect(page.locator("text=입력 방식").first()).toBeVisible({ timeout: 5000 });

    // Verify two source tabs exist
    const directTab = page.locator("button", { hasText: "직접 입력" });
    const notionTab = page.locator("button", { hasText: "Notion 문서" });
    await expect(directTab).toBeVisible();
    await expect(notionTab).toBeVisible();

    // Default should be "직접 입력" active (has primary ring styling)
    // Verify textarea is visible (direct input is default)
    const textarea = page.locator("textarea");
    await expect(textarea).toBeVisible();

    await page.screenshot({ path: "e2e/screenshots/notion-step-1-tabs.png", fullPage: true });
    console.log("✅ 입력 소스 선택기 렌더링 확인");
  });

  // ── Test 2: Tab switching to Notion ─────────────────────────────

  test("Notion 탭 클릭 시 페이지 목록이 표시됨", async ({ page }) => {
    await loginAndNavigateToWizard(page);

    // Click the "Notion 문서" tab
    const notionTab = page.locator("button", { hasText: "Notion 문서" });
    await notionTab.click();
    await page.waitForTimeout(500);

    // Verify textarea is no longer visible
    const textarea = page.locator("textarea");
    await expect(textarea).not.toBeVisible();

    // Verify "Notion 문서 선택" label appears
    await expect(page.locator("text=Notion 문서 선택").first()).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: "e2e/screenshots/notion-step-2-notion-tab.png", fullPage: true });
    console.log("✅ Notion 탭 전환 확인");
  });

  // ── Test 3: Switching back to direct input ──────────────────────

  test("직접입력 탭으로 돌아오면 textarea가 다시 표시됨", async ({ page }) => {
    await loginAndNavigateToWizard(page);

    // Switch to Notion tab
    const notionTab = page.locator("button", { hasText: "Notion 문서" });
    await notionTab.click();
    await page.waitForTimeout(500);

    // Switch back to direct input
    const directTab = page.locator("button", { hasText: "직접 입력" });
    await directTab.click();
    await page.waitForTimeout(500);

    // Verify textarea is visible again
    const textarea = page.locator("textarea");
    await expect(textarea).toBeVisible({ timeout: 5000 });

    // Verify "작업 설명" label is present
    await expect(page.locator("text=작업 설명").first()).toBeVisible();

    await page.screenshot({ path: "e2e/screenshots/notion-step-3-back-to-direct.png", fullPage: true });
    console.log("✅ 직접입력 탭 복귀 확인");
  });

  // ── Test 4: Notion API call is made ─────────────────────────────

  test("Notion 탭 선택 시 API 호출이 발생함", async ({ page }) => {
    await loginAndNavigateToWizard(page);

    // Intercept /api/notion/pages to track the call
    let apiCalled = false;
    await page.route("**/api/notion/pages", async (route) => {
      apiCalled = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockPages),
      });
    });

    // Click Notion tab
    const notionTab = page.locator("button", { hasText: "Notion 문서" });
    await notionTab.click();

    // Wait for API call to complete
    await page.waitForTimeout(2000);

    expect(apiCalled).toBe(true);

    await page.screenshot({ path: "e2e/screenshots/notion-step-4-api-call.png", fullPage: true });
    console.log("✅ Notion API 호출 확인");
  });

  // ── Test 5: Notion pages list rendered (mocked) ─────────────────

  test("Notion 페이지 목록이 정상 로드되면 페이지 아이템이 표시됨", async ({ page }) => {
    await loginAndNavigateToWizard(page);

    // Mock the pages API
    await page.route("**/api/notion/pages", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockPages),
      });
    });

    // Click Notion tab
    const notionTab = page.locator("button", { hasText: "Notion 문서" });
    await notionTab.click();
    await page.waitForTimeout(2000);

    // Verify page items are rendered
    await expect(page.locator("text=로그인 기능 기획서")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=결제 시스템 설계")).toBeVisible();
    await expect(page.locator("text=API 리팩토링 계획")).toBeVisible();

    // Verify search input exists (placeholder: "페이지 검색...")
    const searchInput = page.locator('input[placeholder="페이지 검색..."]');
    await expect(searchInput).toBeVisible();

    // Verify refresh button exists
    const refreshBtn = page.locator("button", { hasText: "새로고침" });
    await expect(refreshBtn).toBeVisible();

    await page.screenshot({ path: "e2e/screenshots/notion-step-5-page-list.png", fullPage: true });
    console.log("✅ Notion 페이지 목록 렌더링 확인");
  });

  // ── Test 6: Page selection → preview → confirm flow ─────────────

  test("페이지 선택 → 미리보기 → 확인 플로우", async ({ page }) => {
    await loginAndNavigateToWizard(page);

    // Mock pages list API
    await page.route("**/api/notion/pages", async (route) => {
      // Only match exact /api/notion/pages, not /api/notion/pages/page-001
      const url = route.request().url();
      if (url.endsWith("/api/notion/pages") || url.endsWith("/api/notion/pages/")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockPages),
        });
      } else {
        await route.continue();
      }
    });

    // Mock page content API
    await page.route("**/api/notion/pages/page-001", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockPageContent),
      });
    });

    // Click Notion tab
    const notionTab = page.locator("button", { hasText: "Notion 문서" });
    await notionTab.click();
    await page.waitForTimeout(2000);

    // Select a page
    const pageItem = page.locator("button", { hasText: "로그인 기능 기획서" }).first();
    await expect(pageItem).toBeVisible({ timeout: 5000 });
    await pageItem.click();
    await page.waitForTimeout(1500);

    await page.screenshot({ path: "e2e/screenshots/notion-step-6a-preview.png", fullPage: true });

    // Verify preview loaded — page title shown in preview header
    await expect(page.locator("text=로그인 기능 기획서").first()).toBeVisible({ timeout: 5000 });

    // Verify word count badge is shown
    await expect(page.locator("text=45자").first()).toBeVisible({ timeout: 5000 });

    // Verify confirm button exists
    const confirmBtn = page.locator("button", { hasText: "이 문서로 분석하기" });
    await expect(confirmBtn).toBeVisible({ timeout: 5000 });

    // Verify back button exists
    const backBtn = page.locator("button", { hasText: "돌아가기" });
    await expect(backBtn).toBeVisible();

    // Click confirm
    await confirmBtn.click();
    await page.waitForTimeout(1000);

    // Verify confirmed state — shows check icon and title with "자 로드됨" suffix
    await expect(page.locator("text=로그인 기능 기획서").first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=로드됨").first()).toBeVisible({ timeout: 5000 });

    // Verify "변경" button appears (to re-select)
    const changeBtn = page.locator("button", { hasText: "변경" });
    await expect(changeBtn).toBeVisible();

    await page.screenshot({ path: "e2e/screenshots/notion-step-6b-confirmed.png", fullPage: true });
    console.log("✅ 페이지 선택 → 미리보기 → 확인 플로우 완료");
  });

  // ── Test 7: Search filtering ────────────────────────────────────

  test("검색으로 페이지 목록 필터링", async ({ page }) => {
    await loginAndNavigateToWizard(page);

    // Mock pages API
    await page.route("**/api/notion/pages", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockPages),
      });
    });

    // Click Notion tab
    const notionTab = page.locator("button", { hasText: "Notion 문서" });
    await notionTab.click();
    await page.waitForTimeout(2000);

    // Verify all 3 pages visible initially
    await expect(page.locator("text=로그인 기능 기획서")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=결제 시스템 설계")).toBeVisible();
    await expect(page.locator("text=API 리팩토링 계획")).toBeVisible();

    // Type in search input
    const searchInput = page.locator('input[placeholder="페이지 검색..."]');
    await searchInput.fill("결제");
    await page.waitForTimeout(500);

    // Verify filtered results — only "결제 시스템 설계" should be visible
    await expect(page.locator("text=결제 시스템 설계")).toBeVisible();
    await expect(page.locator("text=로그인 기능 기획서")).not.toBeVisible();
    await expect(page.locator("text=API 리팩토링 계획")).not.toBeVisible();

    await page.screenshot({ path: "e2e/screenshots/notion-step-7a-filtered.png", fullPage: true });

    // Clear search and verify all pages return
    await searchInput.clear();
    await page.waitForTimeout(500);

    await expect(page.locator("text=로그인 기능 기획서")).toBeVisible();
    await expect(page.locator("text=결제 시스템 설계")).toBeVisible();
    await expect(page.locator("text=API 리팩토링 계획")).toBeVisible();

    // Type a search with no matches
    await searchInput.fill("존재하지않는페이지");
    await page.waitForTimeout(500);

    await expect(page.locator("text=검색 결과가 없습니다")).toBeVisible();

    await page.screenshot({ path: "e2e/screenshots/notion-step-7b-no-results.png", fullPage: true });
    console.log("✅ 검색 필터링 확인");
  });

  // ── Test 8: Error handling ──────────────────────────────────────

  test("Notion API 에러 시 에러 상태 표시", async ({ page }) => {
    await loginAndNavigateToWizard(page);

    // Mock API to return error
    await page.route("**/api/notion/pages", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          data: null,
          error: { message: "Notion API 연결에 실패했습니다.", code: "NOTION_API_ERROR" },
          status: 500,
        }),
      });
    });

    // Click Notion tab
    const notionTab = page.locator("button", { hasText: "Notion 문서" });
    await notionTab.click();
    await page.waitForTimeout(2000);

    // Verify error message is shown
    await expect(
      page.locator("text=Notion API 연결에 실패했습니다.").first()
    ).toBeVisible({ timeout: 5000 });

    // Verify retry button exists
    const retryBtn = page.locator("button", { hasText: "다시 시도" });
    await expect(retryBtn).toBeVisible();

    await page.screenshot({ path: "e2e/screenshots/notion-step-8-error.png", fullPage: true });

    // Test retry — now return success
    await page.route("**/api/notion/pages", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockPages),
      });
    });

    await retryBtn.click();
    await page.waitForTimeout(2000);

    // Verify pages load after retry
    await expect(page.locator("text=로그인 기능 기획서")).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: "e2e/screenshots/notion-step-8b-retry-success.png", fullPage: true });
    console.log("✅ 에러 상태 및 재시도 확인");
  });

  // ── Test 9: Direct input still works ────────────────────────────

  test("직접 입력 모드가 기존과 동일하게 동작함", async ({ page }) => {
    await loginAndNavigateToWizard(page);

    // Switch to 범용 category (no workingDir required)
    const generalBtn = page.locator("button", { hasText: "범용" });
    await generalBtn.click();
    await page.waitForTimeout(300);

    // Verify default tab is direct input
    const textarea = page.locator("textarea");
    await expect(textarea).toBeVisible({ timeout: 5000 });

    // Verify analyze button is disabled with empty input
    const analyzeBtn = page.locator("button", { hasText: "작업 분석" });
    await expect(analyzeBtn).toBeDisabled();

    // Type short text (under 10 chars)
    await textarea.fill("짧은텍스트");
    await page.waitForTimeout(300);

    // Verify analyze button is still disabled (less than 10 chars)
    await expect(analyzeBtn).toBeDisabled();

    // Verify min-length hint is shown
    await expect(page.locator("text=최소 10자 이상").first()).toBeVisible();

    // Type long enough text (10+ chars)
    await textarea.fill("이것은 충분히 긴 텍스트입니다. 최소 10자 이상입니다.");
    await page.waitForTimeout(300);

    // Verify analyze button becomes enabled
    await expect(analyzeBtn).toBeEnabled();

    await page.screenshot({ path: "e2e/screenshots/notion-step-9-direct-input.png", fullPage: true });
    console.log("✅ 직접 입력 모드 동작 확인");
  });

  // ── Test 10: Notion page content used for analysis ──────────────

  test("선택된 Notion 문서로 작업 분석이 실행됨", async ({ page }) => {
    await loginAndNavigateToWizard(page);

    // Switch to 범용 category (no workingDir required)
    const generalBtn = page.locator("button", { hasText: "범용" });
    await generalBtn.click();
    await page.waitForTimeout(300);

    // Mock pages list API
    await page.route("**/api/notion/pages", async (route) => {
      const url = route.request().url();
      if (url.endsWith("/api/notion/pages") || url.endsWith("/api/notion/pages/")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockPages),
        });
      } else {
        await route.continue();
      }
    });

    // Mock page content API
    await page.route("**/api/notion/pages/page-001", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockPageContent),
      });
    });

    // Track parse API call
    let parsePayload: Record<string, unknown> | null = null;
    await page.route("**/api/pipelines/parse", async (route) => {
      const body = route.request().postDataJSON();
      parsePayload = body;
      // Fulfill with a mock parse result so the test does not hang
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            analysis: {
              intent: "로그인 기능 구현",
              scope: "small",
              reasoning: "단일 기능 구현 요청",
            },
            tasks: [
              {
                title: "로그인 기능 구현",
                description: "이메일/비밀번호 기반 로그인 구현",
                agent_role: "engineer",
                order: 1,
                estimated_complexity: "medium",
                acceptance_criteria: "로그인 성공/실패 처리 완료",
              },
            ],
            recommendation: { mode: "auto_edit", reason: "코드 변경이 필요합니다" },
          },
          error: null,
          status: 200,
        }),
      });
    });

    // Switch to Notion tab
    const notionTab = page.locator("button", { hasText: "Notion 문서" });
    await notionTab.click();
    await page.waitForTimeout(2000);

    // Select a page
    const pageItem = page.locator("button", { hasText: "로그인 기능 기획서" }).first();
    await expect(pageItem).toBeVisible({ timeout: 5000 });
    await pageItem.click();
    await page.waitForTimeout(1500);

    // Confirm the page content
    const confirmBtn = page.locator("button", { hasText: "이 문서로 분석하기" });
    await expect(confirmBtn).toBeVisible({ timeout: 5000 });
    await confirmBtn.click();
    await page.waitForTimeout(1000);

    // Verify confirmed state
    await expect(page.locator("text=로드됨").first()).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: "e2e/screenshots/notion-step-10a-ready.png", fullPage: true });

    // Click analyze button
    const analyzeBtn = page.locator("button", { hasText: "작업 분석" });
    await expect(analyzeBtn).toBeEnabled({ timeout: 5000 });
    await analyzeBtn.click();

    // Wait for parse to complete
    await page.waitForTimeout(3000);

    // Verify parse API was called with Notion content
    expect(parsePayload).not.toBeNull();
    expect((parsePayload as unknown as Record<string, unknown>).input).toContain("로그인 기능을 구현한다");

    await page.screenshot({ path: "e2e/screenshots/notion-step-10b-analyzed.png", fullPage: true });
    console.log("✅ Notion 문서 기반 분석 실행 확인");
  });
});
