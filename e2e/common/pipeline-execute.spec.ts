import { test, expect } from "@playwright/test";

test("Pipeline full execution flow", async ({ page }) => {
  test.setTimeout(300000); // 5 min

  // Login
  await page.goto("/login");
  await page.fill('input[type="email"]', "test@claudedev.com");
  await page.fill('input[type="password"]', "Test1234");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**", { timeout: 10000 });
  console.log("✅ Logged in");

  // Go to new pipeline
  await page.goto("/pipelines/new");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);

  // Step 1: Enter task and analyze
  const textarea = page.locator("textarea");
  await textarea.fill("로컬에 claudeDevelopmentSystem 프로젝트 구조를 분석해서 주요 컴포넌트와 API 목록을 정리해줘");
  console.log("✅ Task input filled");

  const analyzeBtn = page.locator("button", { hasText: "분석" });
  await analyzeBtn.click();
  console.log("⏳ Analyzing... (waiting up to 120s)");

  // Wait for analysis by checking the "분석" button reappears (not "분석 중...")
  await page.waitForFunction(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const analyzeBtn = btns.find(b => b.textContent?.includes("분석") && !b.textContent?.includes("분석 중"));
    return analyzeBtn !== undefined;
  }, { timeout: 120000 });
  console.log("✅ Analysis button returned to normal state");

  // Check wizard store for tasks
  const taskCount = await page.evaluate(() => {
    // Access Zustand store from window (devtools expose it)
    const storeState = (window as unknown as Record<string, unknown>);
    // Try to read from the DOM - count task cards that have agent role badges
    const taskCards = document.querySelectorAll('[class*="task-card"], [data-testid*="task"]');
    // Fallback: count items in task list area that have structured content
    const listItems = document.querySelectorAll('.flex.flex-col.gap-2 > div');
    return { taskCards: taskCards.length, listItems: listItems.length };
  });
  console.log("Task detection:", JSON.stringify(taskCount));

  // Screenshot after analysis
  await page.screenshot({ path: "/tmp/exec-01-analyzed.png", fullPage: true });

  // Check if there are visible task items (cards with titles)
  const visibleTasks = await page.locator("text=PM").or(page.locator("text=Engineer")).or(page.locator("text=Reviewer")).count();
  console.log("Visible role-related elements:", visibleTasks);

  // Check error message
  const errorMsg = await page.locator(".text-destructive").textContent().catch(() => null);
  if (errorMsg) {
    console.log("❌ Error:", errorMsg);
  }

  // Step 2: Click 다음 (Next)
  const nextBtn = page.locator("button", { hasText: "다음" });
  await nextBtn.click();
  await page.waitForTimeout(1000);
  console.log("✅ Step 2: Agent config");
  await page.screenshot({ path: "/tmp/exec-02-agents.png", fullPage: true });

  // Step 3: Click 다음 again
  await nextBtn.click();
  await page.waitForTimeout(1000);
  console.log("✅ Step 3: Mode select");
  await page.screenshot({ path: "/tmp/exec-03-mode.png", fullPage: true });

  // Check task count in execution summary
  const summaryText = await page.locator("text=작업 수").locator("..").textContent().catch(() => "");
  console.log("Summary task count text:", summaryText);

  // Submit: Click 파이프라인 생성
  const submitBtn = page.locator("button", { hasText: "파이프라인 생성" });
  if (await submitBtn.count() > 0) {
    console.log("⏳ Creating and executing pipeline...");
    await submitBtn.click();

    // Wait for redirect to /pipelines/[uuid] (not /pipelines/new)
    try {
      await page.waitForFunction(() => {
        const url = window.location.pathname;
        return url.match(/\/pipelines\/[0-9a-f]{8}-/) !== null;
      }, { timeout: 15000 });
      console.log("✅ Redirected to:", page.url());
    } catch {
      console.log("❌ No redirect happened. Still at:", page.url());
      // Check for error message
      const err = await page.locator(".text-destructive").textContent().catch(() => "none");
      console.log("Error message:", err);
      await page.screenshot({ path: "/tmp/exec-error-no-redirect.png", fullPage: true });
    }

    await page.waitForTimeout(3000);
    await page.screenshot({ path: "/tmp/exec-04-monitoring.png", fullPage: true });

    // If on monitoring page, wait for logs
    if (page.url().includes("/pipelines/") && !page.url().includes("/new")) {
      const pipelineId = page.url().split("/pipelines/")[1].split("/")[0];
      console.log("On monitoring page for pipeline:", pipelineId);

      // Test the logs API directly
      await page.waitForTimeout(5000);
      const apiResponse = await page.evaluate(async (pid) => {
        const r = await fetch(`/api/pipelines/${pid}/logs?limit=10`);
        const json = await r.json();
        return { status: r.status, data: json };
      }, pipelineId);
      console.log("API logs response:", JSON.stringify(apiResponse).substring(0, 500));

      // Wait for logs to appear (polling every 5s for up to 120s)
      for (let i = 0; i < 24; i++) {
        await page.waitForTimeout(5000);
        const mainHTML = await page.locator("main").innerHTML().catch(() => "");
        const hasLogText = mainHTML.includes("작업 시작") || mainHTML.includes("CLI 실행") || mainHTML.includes("작업 완료");
        const logLineCount = await page.locator("[class*='font-mono'] [data-index]").count().catch(() => 0);
        console.log(`  [${(i+1)*5}s] Log text in DOM: ${hasLogText}, Log lines: ${logLineCount}`);

        if (hasLogText || logLineCount > 0) {
          console.log("✅ Logs are appearing!");
          break;
        }

        if (i % 4 === 0) {
          await page.screenshot({ path: `/tmp/exec-05-wait-${i}.png`, fullPage: true });
        }
      }

      // Final screenshot
      await page.waitForTimeout(3000);
      await page.screenshot({ path: "/tmp/exec-06-final.png", fullPage: true });

      const finalHTML = await page.locator("main").innerHTML().catch(() => "");
      console.log("Final content length:", finalHTML.length);
      console.log("Final preview:", finalHTML.substring(0, 500));
    }
  } else {
    console.log("❌ Submit button not found");
    await page.screenshot({ path: "/tmp/exec-error-no-submit.png", fullPage: true });
  }
});
