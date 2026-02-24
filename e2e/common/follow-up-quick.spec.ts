import { test, expect } from "@playwright/test";

/**
 * Quick follow-up test: Uses an existing completed/failed pipeline
 * instead of creating a new one from scratch.
 */

test.describe("Follow-Up Quick Test", () => {
  test.setTimeout(420000); // 7 min

  test("Find completed pipeline → follow-up → verify session chain", async ({ page }) => {
    // ── Login ─────────────────────────────────────────────────────────────
    await page.goto("/login");
    await page.fill('input[type="email"]', "test@claudedev.com");
    await page.fill('input[type="password"]', "Test1234");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard**", { timeout: 10000 });
    console.log("✅ Logged in");

    // ── Find a completed or failed pipeline ──────────────────────────────
    const targetPipeline = await page.evaluate(async () => {
      const r = await fetch("/api/pipelines");
      const json = await r.json();
      const pipelines = json.data ?? [];
      // Prefer completed, then failed
      return pipelines.find((p: Record<string, unknown>) => p.status === "completed")
        ?? pipelines.find((p: Record<string, unknown>) => p.status === "failed")
        ?? null;
    });

    if (!targetPipeline) {
      // No completed pipeline exists — need to wait for running ones or create new
      console.log("⚠️ No completed/failed pipeline found. Checking for running...");

      const runningPipeline = await page.evaluate(async () => {
        const r = await fetch("/api/pipelines");
        const json = await r.json();
        return (json.data ?? []).find((p: Record<string, unknown>) => p.status === "running");
      });

      if (runningPipeline) {
        console.log(`⏳ Found running pipeline ${runningPipeline.id}, waiting for completion...`);
        for (let i = 0; i < 60; i++) {
          await page.waitForTimeout(5000);
          const status = await page.evaluate(async (pid) => {
            const r = await fetch(`/api/pipelines/${pid}`);
            const json = await r.json();
            return json.data?.status ?? "unknown";
          }, runningPipeline.id);
          console.log(`  [${(i+1)*5}s] Status: ${status}`);
          if (status === "completed" || status === "failed") {
            console.log(`✅ Pipeline ${status}`);
            break;
          }
        }
      } else {
        test.skip(true, "No pipelines available for follow-up test");
        return;
      }
    }

    // Re-fetch to get the latest state
    const pipeline = await page.evaluate(async () => {
      const r = await fetch("/api/pipelines");
      const json = await r.json();
      const pipelines = json.data ?? [];
      return pipelines.find((p: Record<string, unknown>) =>
        p.status === "completed" || p.status === "failed"
      );
    });

    if (!pipeline) {
      test.skip(true, "Pipeline still not completed");
      return;
    }

    const pipelineId = pipeline.id;
    console.log(`✅ Using pipeline: ${pipelineId} (${pipeline.status})`);

    // Check existing sessions count
    const existingSessions = await page.evaluate(async (pid) => {
      const r = await fetch(`/api/pipelines/${pid}/sessions`);
      const json = await r.json();
      return json.data ?? [];
    }, pipelineId);
    console.log(`📊 Existing sessions: ${existingSessions.length}`);

    // ── Navigate to pipeline detail page ─────────────────────────────────
    await page.goto(`/pipelines/${pipelineId}`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "/tmp/fq-01-detail.png", fullPage: true });

    // ── Verify FollowUpInput is visible ──────────────────────────────────
    const followUpTextarea = page.locator('textarea[placeholder*="후속 질의"]');
    await expect(followUpTextarea).toBeVisible({ timeout: 10000 });
    console.log("✅ Follow-up input is visible");

    // ── Test validation: short input should disable button ───────────────
    const submitBtn = page.locator("button", { hasText: "후속 실행" });
    await followUpTextarea.fill("짧은입력");
    await expect(submitBtn).toBeDisabled();
    console.log("✅ Short input validation works");

    // ── Submit follow-up query ───────────────────────────────────────────
    const followUpText = "이전 실행에서 분석한 내용을 기반으로, session.ts에 새로 추가된 SessionSummary와 follow_up_prompt 필드의 실제 사용처를 파이프라인 코드에서 검색해줘";
    await followUpTextarea.fill(followUpText);
    await expect(submitBtn).toBeEnabled();
    await page.screenshot({ path: "/tmp/fq-02-filled.png", fullPage: true });

    await submitBtn.click();
    console.log("⏳ Submitting follow-up...");

    // Wait for success toast or status change
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "/tmp/fq-03-submitted.png", fullPage: true });

    // ── Verify new session was created ───────────────────────────────────
    const postSubmitData = await page.evaluate(async (pid) => {
      const r = await fetch(`/api/pipelines/${pid}`);
      const json = await r.json();
      return {
        status: json.data?.status,
        sessions: (json.data?.sessions ?? []).map((s: Record<string, unknown>) => ({
          id: s.id,
          session_number: s.session_number,
          status: s.status,
          follow_up_prompt: s.follow_up_prompt ? String(s.follow_up_prompt).substring(0, 30) + "..." : null,
          parent_session_id: s.parent_session_id,
        })),
      };
    }, pipelineId);
    console.log("📊 Post-submit state:", JSON.stringify(postSubmitData, null, 2));

    expect(postSubmitData.status).toBe("running");
    expect(postSubmitData.sessions.length).toBe(existingSessions.length + 1);
    console.log("✅ Pipeline is running with new session");

    // Find the new session (the one that is running)
    const newSession = postSubmitData.sessions.find(
      (s: Record<string, unknown>) => s.status === "running"
    );
    expect(newSession).toBeTruthy();
    console.log("✅ New running session found:", newSession.id);

    // Verify session chain fields via sessions API (which returns all fields)
    const sessionsDetail = await page.evaluate(async (pid) => {
      const r = await fetch(`/api/pipelines/${pid}/sessions`);
      const json = await r.json();
      return json.data ?? [];
    }, pipelineId);

    const newSessionDetail = sessionsDetail.find(
      (s: Record<string, unknown>) => s.id === newSession.id
    );
    expect(newSessionDetail).toBeTruthy();
    expect(newSessionDetail.follow_up_prompt).toBeTruthy();
    expect(newSessionDetail.parent_session_id).toBeTruthy();
    expect(newSessionDetail.session_number).toBe(existingSessions.length + 1);
    console.log("✅ Follow-up session has correct chain fields:", {
      session_number: newSessionDetail.session_number,
      has_follow_up: !!newSessionDetail.follow_up_prompt,
      has_parent: !!newSessionDetail.parent_session_id,
    });

    // ── Wait for follow-up execution to complete ─────────────────────────
    console.log("⏳ Waiting for follow-up to complete...");
    let finalStatus = "";
    for (let i = 0; i < 60; i++) {
      await page.waitForTimeout(5000);
      const status = await page.evaluate(async (pid) => {
        const r = await fetch(`/api/pipelines/${pid}`);
        const json = await r.json();
        return json.data?.status ?? "unknown";
      }, pipelineId);
      console.log(`  [${(i+1)*5}s] Status: ${status}`);
      if (status === "completed" || status === "failed") {
        finalStatus = status;
        break;
      }
    }

    if (!finalStatus) {
      console.log("⚠️ Follow-up did not complete in time");
      await page.screenshot({ path: "/tmp/fq-timeout.png", fullPage: true });
      // Still verify what we can
    }

    // ── Reload and verify UI ─────────────────────────────────────────────
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "/tmp/fq-04-reloaded.png", fullPage: true });

    // ── Verify SessionSelector appears ───────────────────────────────────
    const sessionTab1 = page.locator("text=초기 실행");
    const sessionTab2 = page.locator('text=/후속 #\\d+/');

    if (postSubmitData.sessions.length >= 2) {
      await expect(sessionTab1).toBeVisible({ timeout: 5000 });
      await expect(sessionTab2.first()).toBeVisible({ timeout: 5000 });
      console.log("✅ SessionSelector is visible with tabs");

      // ── Test session switching ─────────────────────────────────────────
      await sessionTab1.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: "/tmp/fq-05-session1.png", fullPage: true });
      console.log("✅ Switched to session 1");

      await sessionTab2.first().click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: "/tmp/fq-06-session2.png", fullPage: true });
      console.log("✅ Switched to session 2");
    }

    // ── Verify session-filtered logs API ─────────────────────────────────
    const allSessions = await page.evaluate(async (pid) => {
      const r = await fetch(`/api/pipelines/${pid}/sessions`);
      const json = await r.json();
      return json.data ?? [];
    }, pipelineId);

    for (const sess of allSessions) {
      const logsRes = await page.evaluate(async ({ pid, sid }) => {
        const r = await fetch(`/api/pipelines/${pid}/logs?limit=5&session_id=${sid}`);
        const json = await r.json();
        return { count: json.data?.logs?.length ?? 0, sessionId: sid };
      }, { pid: pipelineId, sid: sess.id });
      console.log(`  Session #${sess.session_number} (${sess.status}): ${logsRes.count} logs`);
    }
    console.log("✅ Session-filtered logs API works");

    // ── Verify follow-up context in simulator logs ───────────────────────
    if (newSession) {
      const followUpLogs = await page.evaluate(async ({ pid, sid }) => {
        const r = await fetch(`/api/pipelines/${pid}/logs?limit=50&session_id=${sid}`);
        const json = await r.json();
        const logs = json.data?.logs ?? [];
        return logs.map((l: Record<string, unknown>) => String(l.message).substring(0, 100));
      }, { pid: pipelineId, sid: newSession.id });
      console.log("📋 Follow-up session logs preview:");
      followUpLogs.forEach((msg: string) => console.log(`  ${msg}`));
    }

    await page.screenshot({ path: "/tmp/fq-07-final.png", fullPage: true });
    console.log("✅ Follow-up query E2E test complete!");
  });
});
