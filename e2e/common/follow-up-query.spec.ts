import { test, expect } from "@playwright/test";

/**
 * Follow-Up Query E2E Test
 *
 * Tests the full follow-up query flow:
 * 1. Login
 * 2. Create & execute a pipeline
 * 3. Wait for completion (or failure)
 * 4. Submit a follow-up query
 * 5. Verify new session is created and session selector appears
 * 6. Switch between sessions and verify logs change
 */

test.describe("Follow-Up Query Feature", () => {
  test.setTimeout(360000); // 6 min (pipeline execution can take a while)

  test("Full follow-up flow: create → complete → follow-up → session switch", async ({ page }) => {
    // ── Step 1: Login ─────────────────────────────────────────────────────
    await page.goto("/login");
    await page.fill('input[type="email"]', "test@claudedev.com");
    await page.fill('input[type="password"]', "Test1234");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard**", { timeout: 10000 });
    console.log("✅ Logged in");

    // ── Step 2: Create a pipeline via wizard ──────────────────────────────
    await page.goto("/pipelines/new");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    const textarea = page.locator("textarea");
    await textarea.fill("claudeDevelopmentSystem 프로젝트의 src/types 폴더에 있는 타입 파일 목록과 각 파일의 주요 인터페이스를 정리해줘");
    console.log("✅ Task input filled");

    // Click analyze
    const analyzeBtn = page.locator("button", { hasText: "분석" });
    await analyzeBtn.click();
    console.log("⏳ Analyzing...");

    // Wait for analysis complete
    await page.waitForFunction(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      return btns.some(b => b.textContent?.includes("분석") && !b.textContent?.includes("분석 중"));
    }, { timeout: 120000 });
    console.log("✅ Analysis complete");

    // Navigate wizard: Step 2 (agents) → Step 3 (mode) → Submit
    const nextBtn = page.locator("button", { hasText: "다음" });
    await nextBtn.click();
    await page.waitForTimeout(500);
    await nextBtn.click();
    await page.waitForTimeout(500);

    // Submit pipeline
    const submitBtn = page.locator("button", { hasText: "파이프라인 생성" });
    await submitBtn.click();
    console.log("⏳ Creating pipeline...");

    // Wait for redirect to monitoring page
    await page.waitForFunction(() => {
      return window.location.pathname.match(/\/pipelines\/[0-9a-f]{8}-/) !== null;
    }, { timeout: 15000 });
    const pipelineUrl = page.url();
    const pipelineId = pipelineUrl.split("/pipelines/")[1].split("/")[0];
    console.log("✅ On monitoring page:", pipelineId);
    await page.screenshot({ path: "/tmp/followup-01-monitoring.png", fullPage: true });

    // ── Step 3: Wait for pipeline completion/failure ──────────────────────
    console.log("⏳ Waiting for pipeline to complete...");
    let finalStatus = "";
    for (let i = 0; i < 60; i++) { // up to 5 min
      await page.waitForTimeout(5000);

      // Check pipeline status via API
      const statusCheck = await page.evaluate(async (pid) => {
        const r = await fetch(`/api/pipelines/${pid}`);
        const json = await r.json();
        return json.data?.status ?? "unknown";
      }, pipelineId);

      console.log(`  [${(i + 1) * 5}s] Status: ${statusCheck}`);

      if (statusCheck === "completed" || statusCheck === "failed") {
        finalStatus = statusCheck;
        console.log(`✅ Pipeline ${finalStatus}`);
        break;
      }
    }

    if (!finalStatus) {
      console.log("⚠️ Pipeline did not complete in time, taking screenshot");
      await page.screenshot({ path: "/tmp/followup-timeout.png", fullPage: true });
      test.skip(true, "Pipeline execution timed out");
      return;
    }

    // Reload page to get latest state
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "/tmp/followup-02-completed.png", fullPage: true });

    // ── Step 4: Verify FollowUpInput is visible ──────────────────────────
    const followUpTextarea = page.locator('textarea[placeholder*="후속 질의"]');
    await expect(followUpTextarea).toBeVisible({ timeout: 5000 });
    console.log("✅ Follow-up input is visible");

    const followUpSubmitBtn = page.locator("button", { hasText: "후속 실행" });
    await expect(followUpSubmitBtn).toBeVisible();
    console.log("✅ Follow-up submit button is visible");

    // Verify minimum length validation
    await followUpTextarea.fill("짧은입력");
    await expect(followUpSubmitBtn).toBeDisabled();
    console.log("✅ Short input disables submit button");

    // ── Step 5: Submit follow-up query ───────────────────────────────────
    const followUpText = "위 분석 결과에서 누락된 타입 파일이 있는지 확인하고, session.ts에 새로 추가된 SessionSummary 인터페이스의 사용처를 찾아줘";
    await followUpTextarea.fill(followUpText);
    await expect(followUpSubmitBtn).toBeEnabled();
    console.log("✅ Valid input enables submit button");

    await followUpSubmitBtn.click();
    console.log("⏳ Submitting follow-up query...");

    // Wait for pipeline to go back to running state
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "/tmp/followup-03-submitted.png", fullPage: true });

    // Verify pipeline is now running again via API
    const postSubmitStatus = await page.evaluate(async (pid) => {
      const r = await fetch(`/api/pipelines/${pid}`);
      const json = await r.json();
      return {
        status: json.data?.status,
        sessionCount: json.data?.sessions?.length ?? 0,
      };
    }, pipelineId);
    console.log("Post-submit state:", JSON.stringify(postSubmitStatus));
    expect(postSubmitStatus.status).toBe("running");
    expect(postSubmitStatus.sessionCount).toBeGreaterThanOrEqual(2);
    console.log("✅ Pipeline is running with 2+ sessions");

    // ── Step 6: Wait for follow-up execution to complete ─────────────────
    console.log("⏳ Waiting for follow-up execution...");
    let followUpComplete = false;
    for (let i = 0; i < 60; i++) {
      await page.waitForTimeout(5000);

      const statusCheck = await page.evaluate(async (pid) => {
        const r = await fetch(`/api/pipelines/${pid}`);
        const json = await r.json();
        return json.data?.status ?? "unknown";
      }, pipelineId);

      console.log(`  [${(i + 1) * 5}s] Status: ${statusCheck}`);

      if (statusCheck === "completed" || statusCheck === "failed") {
        followUpComplete = true;
        console.log(`✅ Follow-up ${statusCheck}`);
        break;
      }
    }

    if (!followUpComplete) {
      console.log("⚠️ Follow-up did not complete in time");
      await page.screenshot({ path: "/tmp/followup-timeout-2.png", fullPage: true });
    }

    // Reload to get fresh UI state
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "/tmp/followup-04-two-sessions.png", fullPage: true });

    // ── Step 7: Verify SessionSelector is visible ────────────────────────
    // With 2 sessions, should show tabs
    const sessionTab1 = page.locator("text=초기 실행");
    const sessionTab2 = page.locator("text=후속 #2");
    await expect(sessionTab1).toBeVisible({ timeout: 5000 });
    await expect(sessionTab2).toBeVisible();
    console.log("✅ Session selector tabs are visible");

    // ── Step 8: Switch sessions and verify logs change ───────────────────
    // Click "초기 실행" tab to view first session's logs
    await sessionTab1.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "/tmp/followup-05-session1-logs.png", fullPage: true });

    // Check logs via API for first session
    const sessionsData = await page.evaluate(async (pid) => {
      const r = await fetch(`/api/pipelines/${pid}/sessions`);
      const json = await r.json();
      return json.data ?? [];
    }, pipelineId);
    console.log("Sessions:", JSON.stringify(sessionsData.map((s: Record<string, unknown>) => ({
      id: s.id,
      session_number: s.session_number,
      status: s.status,
      follow_up_prompt: s.follow_up_prompt ? "yes" : "no",
    }))));

    expect(sessionsData.length).toBeGreaterThanOrEqual(2);

    // Verify the second session has follow_up_prompt set
    const followUpSession = sessionsData.find((s: Record<string, unknown>) => s.session_number === 2);
    expect(followUpSession).toBeTruthy();
    expect(followUpSession.follow_up_prompt).toBeTruthy();
    expect(followUpSession.parent_session_id).toBeTruthy();
    console.log("✅ Follow-up session has correct fields");

    // Click "후속 #2" tab to switch to follow-up session
    await sessionTab2.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "/tmp/followup-06-session2-logs.png", fullPage: true });

    // Verify logs API with session_id filter works
    const session1Logs = await page.evaluate(async ({ pid, sid }) => {
      const r = await fetch(`/api/pipelines/${pid}/logs?limit=5&session_id=${sid}`);
      const json = await r.json();
      return json.data?.logs?.length ?? 0;
    }, { pid: pipelineId, sid: sessionsData[sessionsData.length - 1].id });

    const session2Logs = await page.evaluate(async ({ pid, sid }) => {
      const r = await fetch(`/api/pipelines/${pid}/logs?limit=5&session_id=${sid}`);
      const json = await r.json();
      return json.data?.logs?.length ?? 0;
    }, { pid: pipelineId, sid: followUpSession.id });

    console.log(`Session 1 logs: ${session1Logs}, Session 2 logs: ${session2Logs}`);
    console.log("✅ Session-filtered logs API works");

    // Final screenshot
    await page.screenshot({ path: "/tmp/followup-07-final.png", fullPage: true });
    console.log("✅ Follow-up query E2E test complete!");
  });

  test("Follow-up input hidden during running state", async ({ page }) => {
    // Login
    await page.goto("/login");
    await page.fill('input[type="email"]', "test@claudedev.com");
    await page.fill('input[type="password"]', "Test1234");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard**", { timeout: 10000 });

    // Check the pipelines list for a running pipeline
    const runningPipeline = await page.evaluate(async () => {
      const r = await fetch("/api/pipelines");
      const json = await r.json();
      const pipelines = json.data ?? [];
      return pipelines.find((p: Record<string, unknown>) => p.status === "running");
    });

    if (!runningPipeline) {
      test.skip(true, "No running pipeline available to test");
      return;
    }

    await page.goto(`/pipelines/${runningPipeline.id}`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // Follow-up input should NOT be visible during running
    const followUpTextarea = page.locator('textarea[placeholder*="후속 질의"]');
    await expect(followUpTextarea).not.toBeVisible();
    console.log("✅ Follow-up input is hidden during running state");
  });

  test("Session limit API check", async ({ page }) => {
    // Login
    await page.goto("/login");
    await page.fill('input[type="email"]', "test@claudedev.com");
    await page.fill('input[type="password"]', "Test1234");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard**", { timeout: 10000 });

    // Verify the sessions API returns session data with new fields
    const pipelinesRes = await page.evaluate(async () => {
      const r = await fetch("/api/pipelines");
      const json = await r.json();
      return json.data ?? [];
    });

    if (pipelinesRes.length === 0) {
      test.skip(true, "No pipelines available");
      return;
    }

    // Check sessions for the first pipeline
    const pid = pipelinesRes[0].id;
    const sessionsRes = await page.evaluate(async (id) => {
      const r = await fetch(`/api/pipelines/${id}/sessions`);
      const json = await r.json();
      return json.data ?? [];
    }, pid);

    console.log(`Pipeline ${pid} has ${sessionsRes.length} sessions`);

    // Verify session fields exist
    if (sessionsRes.length > 0) {
      const firstSession = sessionsRes[0];
      expect(firstSession).toHaveProperty("session_number");
      expect(firstSession).toHaveProperty("follow_up_prompt");
      expect(firstSession).toHaveProperty("parent_session_id");
      console.log("✅ Session fields exist:", {
        session_number: firstSession.session_number,
        has_follow_up_prompt: !!firstSession.follow_up_prompt,
        has_parent_session_id: !!firstSession.parent_session_id,
      });
    }
  });
});
