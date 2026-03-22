import { test } from "@playwright/test";

test("Vercel - pipeline detail click test", async ({ page }) => {
  test.setTimeout(60000);

  // Login
  await page.goto("/login");
  await page.fill('input[type="email"]', "test@claudedev.com");
  await page.fill('input[type="password"]', "Test1234");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**", { timeout: 10000 });
  console.log("✅ Login OK");

  // Go to pipelines
  await page.goto("/pipelines");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "/tmp/vercel-01-pipelines.png", fullPage: true });

  // Find pipeline links with UUID
  const pipelineLinks = page.locator('a[href*="/pipelines/"][href*="-"]');
  const count = await pipelineLinks.count();
  console.log("Pipeline links found:", count);

  for (let i = 0; i < count; i++) {
    const href = await pipelineLinks.nth(i).getAttribute("href");
    const text = await pipelineLinks.nth(i).textContent();
    console.log(`  [${i}] "${text?.trim().substring(0, 40)}" → ${href}`);
  }

  // Click each pipeline and screenshot
  for (let i = 0; i < count; i++) {
    const href = await pipelineLinks.nth(i).getAttribute("href");
    const text = await pipelineLinks.nth(i).textContent();
    console.log(`\nClicking pipeline ${i}: "${text?.trim().substring(0, 30)}"`);

    await page.goto(href!);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `/tmp/vercel-02-detail-${i}.png`, fullPage: true });

    const url = page.url();
    const mainHTML = await page.locator("main").innerHTML().catch(() => "EMPTY");
    const hasError = mainHTML.includes("not found") || mainHTML.includes("error") || mainHTML.length < 100;
    console.log(`  URL: ${url}`);
    console.log(`  Content length: ${mainHTML.length}`);
    console.log(`  Has error: ${hasError}`);
    console.log(`  Preview: ${mainHTML.substring(0, 300)}`);
  }
});
