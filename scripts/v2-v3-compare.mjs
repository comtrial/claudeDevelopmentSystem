#!/usr/bin/env node
// v2 vs v3 PM 프롬프트 품질 비교 — Claude CLI 직접 호출
// Usage: node scripts/v2-v3-compare.mjs

import { spawn } from "child_process";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = join(__dirname, "..");

// ─── 테스트 태스크 ───
const tasks = [
  { title: "로그인 페이지에 Google OAuth 추가", description: "현재 이메일/비밀번호 로그인만 지원. Google OAuth 로그인 버튼을 추가하고, Supabase Auth와 연동해야 함. 기존 로그인 플로우를 깨뜨리지 않아야 함." },
  { title: "대시보드에 최근 활동 위젯 추가", description: "대시보드 페이지에 최근 파이프라인 실행 기록을 보여주는 위젯 추가. 최근 5개 표시, 상태 뱃지 포함." },
  { title: "API rate limiting 미들웨어 구현", description: "모든 API 라우트에 rate limiting 적용. IP 기반 분당 60회 제한. 429 응답 + Retry-After 헤더." },
];

// ─── v2 프롬프트 (이전 버전) ───
function buildV2() {
  const systemPrompt = [
    `Working directory: ${PROJECT_DIR}`,
    "IMPORTANT: First read CLAUDE.md in the project root for conventions.",
    "Read relevant source files BEFORE making any changes.",
    `Date: 2026-02-24`,
  ].join("\n");

  let userPrompt = `You are a Project Manager. Analyze ALL tasks below holistically. Create a unified plan, identify dependencies, prioritize, and define clear specifications for the engineering team.\n\n## Tasks\n`;
  for (let i = 0; i < tasks.length; i++) {
    userPrompt += `### Task ${i + 1}: ${tasks[i].title}\n${tasks[i].description}\n\n`;
  }
  userPrompt += `## Execution Mode: plan_only\n`;
  userPrompt += `Complete your role for ALL tasks above. Be thorough and provide actionable output. Respond in Korean.`;

  return { systemPrompt, userPrompt };
}

// ─── v3 프롬프트 (현재 버전) ───
function buildV3() {
  // CLAUDE.md 로드
  let claudeMd = "";
  try {
    claudeMd = readFileSync(join(PROJECT_DIR, "CLAUDE.md"), "utf-8");
    if (claudeMd.length > 8000) claudeMd = claudeMd.slice(0, 8000) + "\n...(truncated)";
  } catch { /* ignore */ }

  const systemPrompt = [
    // Role Identity
    `You are a Senior Technical Project Manager who has shipped 50+ production systems.
You have a bias toward SIMPLICITY — over-engineered specs cause more bugs than they prevent.
Your style: read first, plan second, write specs third. You are SKEPTICAL of broad tasks.`,
    // Permanent Rules
    `## CONSTRAINTS (always follow)
- Analyze ONLY what is requested. Do NOT invent requirements beyond task scope.
- "Implicit requirements" = technical necessities only, NOT feature ideas.
- Never assume file structure — verify by reading actual files.
- Each task spec: MAX 20 lines (excluding code blocks).
- Language: Respond in Korean.`,
    // Working dir
    `Working directory: ${PROJECT_DIR}`,
    // CLAUDE.md injection
    claudeMd ? `## Project Conventions (from CLAUDE.md)\n${claudeMd}` : "",
    // Date
    `Date: 2026-02-24`,
  ].filter(Boolean).join("\n\n");

  // Methodology (user prompt)
  const methodology = `<instructions>
## Your Methodology

### Step 0: Project Discovery (MANDATORY)
Before analyzing ANY task:
1. Read CLAUDE.md in the project root
2. Read package.json for dependencies and scripts
3. Glob src/ to understand file structure
4. ONLY THEN begin analysis

### Step 1: Holistic Analysis
- Read each task. Identify cross-task dependencies.
- Determine execution order. Note shared files/components.

### Step 2: Dependency Graph
- Map which tasks depend on others
- Identify shared infrastructure changes

### Step 3: Risk Assessment
For each task: [Low/Medium/High] with 1-line reasoning.

### Step 4: Task Specification
For EACH task, output this EXACT structure:
\`\`\`
## Task N: {title}
- **목표**: 1-2 sentences
- **수정 파일**: list of files to create/modify (VERIFIED by reading)
- **구현 단계**: numbered steps (max 5)
- **검증 방법**: how to verify it works
- **의존성**: other tasks this depends on (or "없음")
- **위험도**: Low/Medium/High + reason
\`\`\`

### Step 5: Execution Order
Final recommended order with reasoning.

### Self-Check (before submitting)
- [ ] Did I read actual files before specifying paths?
- [ ] Is each spec ≤ 20 lines?
- [ ] Did I invent any requirements not in the original tasks?
- [ ] Are all file paths verified against real project structure?

## Common Mistakes to AVOID
- DO NOT invent requirements beyond what was requested
- DO NOT assume file paths without reading the actual project
- DO NOT write specs longer than 20 lines per task
- DO NOT skip Step 0 (Project Discovery)
</instructions>`;

  let userPrompt = methodology + "\n\n";
  userPrompt += `<tasks count="${tasks.length}">\n`;
  for (let i = 0; i < tasks.length; i++) {
    userPrompt += `<task index="${i + 1}" title="${tasks[i].title}">\n${tasks[i].description}\n</task>\n`;
  }
  userPrompt += `</tasks>\n\n<execution-mode>plan_only</execution-mode>`;

  return { systemPrompt, userPrompt };
}

// ─── Claude CLI 실행 ───
function runClaude(label, systemPrompt, userPrompt, maxTurns) {
  return new Promise((resolve, reject) => {
    console.log(`\n${"═".repeat(60)}`);
    console.log(`  [${label}] 실행 중... (max-turns: ${maxTurns})`);
    console.log(`  System prompt: ${systemPrompt.length} chars`);
    console.log(`  User prompt: ${userPrompt.length} chars`);
    console.log(`${"═".repeat(60)}\n`);

    const args = [
      "-p", userPrompt,
      "--append-system-prompt", systemPrompt,
      "--output-format", "text",
      "--max-turns", String(maxTurns),
      "--model", "sonnet",
      "--allowedTools", "Read", "Glob", "Grep",
    ];

    const child = spawn("claude", args, {
      cwd: PROJECT_DIR,
      env: { ...process.env, PATH: process.env.PATH, CLAUDECODE: "" },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });

    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`${label} timeout (5min)`));
    }, 5 * 60 * 1000);

    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0 && !stdout) {
        reject(new Error(`${label} exit code ${code}: ${stderr}`));
      } else {
        resolve(stdout);
      }
    });
  });
}

// ─── Main ───
async function main() {
  const outDir = join(PROJECT_DIR, "scripts", "compare-results");
  mkdirSync(outDir, { recursive: true });

  const v2 = buildV2();
  const v3 = buildV3();

  // 프롬프트 크기 비교 출력
  console.log("\n📊 프롬프트 크기 비교:");
  console.log(`  v2 System: ${v2.systemPrompt.length} chars | User: ${v2.userPrompt.length} chars | Total: ${v2.systemPrompt.length + v2.userPrompt.length}`);
  console.log(`  v3 System: ${v3.systemPrompt.length} chars | User: ${v3.userPrompt.length} chars | Total: ${v3.systemPrompt.length + v3.userPrompt.length}`);

  // v2 실행
  console.log("\n🔄 v2 (기존) PM 실행...");
  const startV2 = Date.now();
  const v2Result = await runClaude("v2-PM", v2.systemPrompt, v2.userPrompt, 10);
  const v2Time = ((Date.now() - startV2) / 1000).toFixed(1);

  // v3 실행
  console.log("\n🔄 v3 (개선) PM 실행...");
  const startV3 = Date.now();
  const v3Result = await runClaude("v3-PM", v3.systemPrompt, v3.userPrompt, 15);
  const v3Time = ((Date.now() - startV3) / 1000).toFixed(1);

  // 결과 저장
  writeFileSync(join(outDir, "v2-pm-output.md"), v2Result);
  writeFileSync(join(outDir, "v3-pm-output.md"), v3Result);

  // 비교 요약
  const summary = `# v2 vs v3 PM Output 비교

## 실행 정보
| 항목 | v2 | v3 |
|------|----|----|
| System Prompt | ${v2.systemPrompt.length} chars | ${v3.systemPrompt.length} chars |
| User Prompt | ${v2.userPrompt.length} chars | ${v3.userPrompt.length} chars |
| 실행 시간 | ${v2Time}s | ${v3Time}s |
| 출력 길이 | ${v2Result.length} chars | ${v3Result.length} chars |
| max-turns | 10 | 15 |

## v2 출력 (첫 2000자)
\`\`\`
${v2Result.slice(0, 2000)}
\`\`\`

## v3 출력 (첫 2000자)
\`\`\`
${v3Result.slice(0, 2000)}
\`\`\`
`;
  writeFileSync(join(outDir, "comparison-summary.md"), summary);

  console.log(`\n${"═".repeat(60)}`);
  console.log("  비교 완료!");
  console.log(`${"═".repeat(60)}`);
  console.log(`\n  v2: ${v2Result.length} chars (${v2Time}s)`);
  console.log(`  v3: ${v3Result.length} chars (${v3Time}s)`);
  console.log(`\n  결과 저장: ${outDir}/`);
  console.log(`    - v2-pm-output.md`);
  console.log(`    - v3-pm-output.md`);
  console.log(`    - comparison-summary.md`);
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
