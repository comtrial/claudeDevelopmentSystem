/**
 * Pipeline Executor — Agent Chain Architecture v3
 *
 * PM → Engineer → Reviewer chain with:
 * 1. Methodology-based rich prompts with XML structure
 * 2. System/User prompt separation (identity→system, task→user)
 * 3. Mode-based chain filtering (plan_only→PM, review→Eng+Rev, auto_edit→all)
 * 4. Feedback loop with Reviewer re-verification (max 2 cycles)
 * 5. Multi-step validation (build + lint + typecheck)
 * 6. CLAUDE.md auto-injection into system prompt
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { spawn, execSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";

// ─── Service Client ─────────────────────────────────────────

function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export type SimulatorSpeed = "slow" | "normal" | "fast";

export interface SimulatorOptions {
  speed?: SimulatorSpeed;
  errorRate?: number;
}

const CLAUDE_BIN = (() => {
  const fromEnv = process.env.CLAUDE_CLI_PATH;
  if (fromEnv) return fromEnv;
  try {
    return execSync("which claude", { encoding: "utf-8" }).trim();
  } catch {
    return `${process.env.HOME}/.local/bin/claude`;
  }
})();

const DEFAULT_ALLOWED_TOOLS = [
  "mcp__claude_ai_Notion",
  "Bash",
  "Read",
  "Write",
  "Edit",
  "Glob",
  "Grep",
  "WebFetch",
  "WebSearch",
];

const activeSimulations = new Map<string, boolean>();

export function stopSimulation(pipelineId: string): void {
  activeSimulations.set(pipelineId, false);
}

// ─── Types ──────────────────────────────────────────────────

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  order_index: number;
}

interface AgentRow {
  id: string;
  role: string;
  name: string | null;
  instruction: string | null;
  model: string | null;
  config: {
    label?: string;
    allowedTools?: string[];
    chainOrder?: number;
    maxTurns?: number;
    output_artifact?: string;
  } | null;
}

interface CLIOptions {
  allowedTools?: string[];
  model?: string;
  maxTurns?: number;
  cwd?: string;
  systemPrompt?: string;
  timeout?: number;
}

type SupabaseClient = ReturnType<typeof createServiceClient>;

const MAX_ARTIFACT_LENGTH = 60000;
const MAX_ARTIFACT_SAVE_LENGTH = 200000;
const MAX_REWORK_CYCLES = 2;

// ─── Mode → Chain Filter ────────────────────────────────────

const MODE_ROLE_FILTER: Record<string, Set<string>> = {
  plan_only: new Set(["pm"]),
  review: new Set(["engineer", "reviewer"]),
  auto_edit: new Set(["pm", "engineer", "reviewer"]),
};

// ─── Logging ────────────────────────────────────────────────

async function insertLog(
  supabase: SupabaseClient,
  sessionId: string,
  _agentId: string,
  agentRole: string,
  level: string,
  message: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase.from("agent_logs").insert({
    session_id: sessionId,
    agent_role: agentRole,
    level,
    message,
    metadata: metadata ?? {},
  });
  if (error) {
    console.error("[insertLog] Failed:", error.message, { sessionId, agentRole, level });
  }
}

// ─── Claude CLI Runner ──────────────────────────────────────

function runClaudeCLI(
  prompt: string,
  onChunk: (chunk: string) => void,
  signal: { cancelled: boolean },
  options?: CLIOptions
): Promise<{ stdout: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    delete env.CLAUDECODE;
    delete env.CLAUDE_CODE;
    delete env.CLAUDE_CODE_ENTRYPOINT;
    delete env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS;

    const model = options?.model ?? "sonnet";
    const maxTurns = options?.maxTurns ?? 25;
    const args = ["-p", prompt, "--output-format", "text", "--max-turns", String(maxTurns), "--model", model];

    if (options?.allowedTools && options.allowedTools.length > 0) {
      for (const tool of options.allowedTools) {
        args.push("--allowedTools", tool);
      }
    }

    if (options?.systemPrompt) {
      args.push("--append-system-prompt", options.systemPrompt);
    }

    const spawnOptions: { env: typeof env; stdio: ["ignore", "pipe", "pipe"]; cwd?: string } = {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    };
    if (options?.cwd) {
      spawnOptions.cwd = options.cwd;
    }

    const child = spawn(CLAUDE_BIN, args, spawnOptions);

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      onChunk(text);
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    const timeoutMs = options?.timeout ?? 1200000;
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Claude CLI timed out (${Math.round(timeoutMs / 60000)} min)`));
    }, timeoutMs);

    const cancelCheck = setInterval(() => {
      if (signal.cancelled) {
        child.kill("SIGTERM");
        clearInterval(cancelCheck);
      }
    }, 1000);

    child.on("close", (code) => {
      clearTimeout(timeout);
      clearInterval(cancelCheck);
      resolve({ stdout, exitCode: code ?? 0 });
    });

    child.on("error", (err) => {
      clearTimeout(timeout);
      clearInterval(cancelCheck);
      reject(err);
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// PROMPT SYSTEM — System/User Separation + XML Structure
// ═══════════════════════════════════════════════════════════════

// ─── System Prompt: Role Identity + Permanent Rules ─────────
// (goes to --append-system-prompt — higher compliance for constraints)

const ROLE_IDENTITY: Record<string, string> = {
  pm: `You are a Senior Technical Project Manager who has shipped 50+ production systems.
You have a bias toward SIMPLICITY — over-engineered specs cause more bugs than they prevent.
Your style: read first, plan second, write specs third. You are SKEPTICAL of broad tasks.`,

  engineer: `You are a Senior Software Engineer with deep expertise in the project's tech stack.
You write minimal, correct code. You NEVER modify a file without reading it first.
You match existing codebase patterns exactly. You do not over-engineer.`,

  reviewer: `You are a Senior Code Reviewer who catches real bugs, not style nitpicks.
You always read ACTUAL source files before reviewing — never trust summaries alone.
You cite specific file paths and line numbers for every issue you raise.`,
};

const PERMANENT_RULES: Record<string, string> = {
  pm: `## CONSTRAINTS (always follow)
- Analyze ONLY what is requested. Do NOT invent requirements beyond task scope.
- "Implicit requirements" = technical necessities only (e.g. "add button" implies event handler), NOT feature ideas.
- Never assume file structure — verify by reading actual files.
- Each task spec: MAX 20 lines (excluding code blocks).
- Language: Respond in Korean.`,

  engineer: `## CONSTRAINTS (always follow)
- If PM's spec conflicts with actual codebase, CODEBASE WINS. State discrepancy.
- NEVER modify a file you haven't Read first.
- NEVER create new files when you can Edit existing ones.
- DO NOT add error handling, comments, or features not in the spec.
- DO NOT leave TODO comments — implement it or flag as out-of-scope.
- Complete one task fully before starting the next.
- Language: Respond in Korean.`,

  reviewer: `## CONSTRAINTS (always follow)
- ONLY review code CHANGED or ADDED by Engineer. Pre-existing issues → note as "Pre-existing", don't block.
- Reviews without actual file reads and line number citations are INVALID.
- Review priority: SECURITY > CORRECTNESS > COMPLETENESS > CONSISTENCY > STYLE.
- NEVER block on style alone if it matches existing codebase.
- MUST end with VERDICT: APPROVED or VERDICT: CHANGES_REQUESTED.
- Language: Respond in Korean.`,
};

/**
 * Build --append-system-prompt: identity + rules + project context + CLAUDE.md
 */
function buildSystemPrompt(
  agent: AgentRow,
  pipelineConfig?: Record<string, unknown>
): string {
  const parts: string[] = [];
  const today = new Date().toISOString().split("T")[0];
  const workingDir = pipelineConfig?.working_dir as string | undefined;

  // Role identity + permanent rules
  parts.push(ROLE_IDENTITY[agent.role] ?? ROLE_IDENTITY.engineer);
  parts.push(PERMANENT_RULES[agent.role] ?? PERMANENT_RULES.engineer);

  // Project context
  if (workingDir) {
    parts.push(`Working directory: ${workingDir}`);

    // Auto-load CLAUDE.md into system prompt
    try {
      const claudeMd = readFileSync(join(workingDir, "CLAUDE.md"), "utf-8");
      const truncated = claudeMd.length > 8000
        ? claudeMd.substring(0, 8000) + "\n... (truncated)"
        : claudeMd;
      parts.push(`## Project Conventions (from CLAUDE.md)\n${truncated}`);
    } catch {
      parts.push("Read CLAUDE.md in the project root for conventions.");
    }
  }

  parts.push(`Date: ${today}`);

  return parts.join("\n\n");
}

// ─── User Prompt: Methodology + Tasks + Artifacts ───────────
// (goes to -p — the "what to do this time")

const METHODOLOGY_PROMPTS: Record<string, string> = {
  pm: `<instructions>
## Your Methodology

### Step 0: Project Discovery (MANDATORY — do this BEFORE any analysis)
1. Read CLAUDE.md — understand ALL conventions
2. Read package.json — understand dependencies and scripts
3. Use Glob to explore src/ directory structure — understand the architecture
4. ONLY THEN begin analyzing tasks

DO NOT produce any spec until you have completed Step 0.

### Step 1: Holistic Analysis
Read ALL tasks. For each, analyze:
- What is the user's actual end goal?
- What TECHNICAL necessities are implied? (not feature ideas)
- What existing code/architecture constraints exist?

**Output Required**: Write a summary of findings before proceeding.

### Step 2: Dependency Graph
For each task identify:
- **Blockers**: What must be done first?
- **Enables**: What does this unblock?
- **Conflicts**: Do any tasks contradict?

### Step 3: Risk Assessment
Rate each task (low/medium/high):
- Technical complexity
- Blast radius (files/systems affected)
- Reversibility

### Step 4: Specification
For EACH task produce:
\`\`\`
## Task: {title}
### Goal: {one sentence}
### Files to Modify: {verified file paths}
### Approach: {step-by-step}
### Acceptance Criteria:
- [ ] {testable criterion}
### Risks: {what could go wrong}
### Dependencies: {other tasks that must complete first}
\`\`\`

### Step 5: Execution Order
Numbered list respecting dependencies.

### Self-Check
Before finalizing: Did you miss any task? Did you verify file paths exist? Rate confidence 1-5 per task.

## Common Mistakes to AVOID
- DO NOT invent requirements not in the tasks
- DO NOT suggest improvements beyond scope
- DO NOT assume file paths without verifying
- DO NOT write specs for tasks that are already done
</instructions>`,

  engineer: `<instructions>
## Your Methodology

### Tool Use Strategy (FOLLOW THIS ORDER)
1. **Glob** first: Find files matching PM's spec patterns
2. **Grep** second: Search for related functions, types, imports
3. **Read** third: Read specific files to modify + their test files
4. **Edit** for changes: Use Edit (not Write) for existing files
5. **Bash** for verification: Run build/typecheck after changes

### Before Each Edit (MANDATORY Dry Run)
For each file you modify:
1. State: "Changing {function/component} in {file}"
2. State: "This affects: {callers/importers}"
3. State: "Potential side effects: {or 'none expected'}"
ONLY THEN make the edit.

### Incremental Implementation
- Follow PM's execution order exactly
- Complete Task 1 fully (implement + verify) before Task 2
- After each task: read back modified files to confirm correctness
- If 5+ files change, split into sub-steps

### Output Format
For EACH task completed:
\`\`\`
## Task: {title} — DONE
### Changes Made:
- {file_path}: {what changed and why}
### Verification:
- {how you verified}
### Notes:
- {anything reviewer should check}
\`\`\`

### When Things Go Wrong
- File doesn't exist → check PM spec error, log discrepancy, use correct path
- Patterns don't match expectations → read more surrounding code first
- Unsure about a change → implement MINIMAL version, flag in Notes

## Common Mistakes to AVOID
- DO NOT create new files when editing existing ones suffices
- DO NOT add try-catch unless PM's spec requires it
- DO NOT modify files not in PM's "Files to Modify" without stating why
- DO NOT leave TODO comments
- DO NOT add docstrings/comments to code you didn't change
</instructions>`,

  reviewer: `<instructions>
## Your Methodology

### MANDATORY File Reading Protocol
For EACH file the Engineer claims to have modified:
1. Read the ACTUAL file using the Read tool
2. In your review, quote SPECIFIC line numbers you verified
3. If you cannot read a file, state "UNVERIFIED: {file}" explicitly

A review that does not cite actual line numbers from actual files is a FAILED review.

### Step 1: Verify Intent
Read PM's analysis. Understand WHAT should have been done and WHY.

### Step 2: Verify Completeness
For each task in PM's spec:
- Was it implemented?
- Were ALL acceptance criteria met?
- Any tasks skipped or partial?

### Step 3: Code Quality Review (in priority order — stop at first blocker)

**SECURITY** (always blocks):
- Injection vulnerabilities (SQL, XSS, command)?
- Sensitive data exposure?
- Auth gaps?

**CORRECTNESS** (always blocks):
- Logic errors, off-by-one, race conditions?
- Edge cases handled?

**COMPLETENESS** (blocks if missing):
- All acceptance criteria met?

**CONSISTENCY** (blocks only if egregious):
- Matches existing codebase patterns?

**STYLE** (NEVER blocks alone):
- Only note if extremely inconsistent

### Step 4: Scope Check
- Is this a NEW issue by Engineer, or pre-existing?
- Does the "issue" match how this codebase works? (Check CLAUDE.md)
- Would fixing this actually improve the code?

### Step 5: Verdict
You MUST end with EXACTLY one of:

<example type="approved">
## VERDICT: APPROVED
All tasks completed correctly. No blocking issues found.
Minor suggestions: ...
</example>

<example type="changes_requested">
## VERDICT: CHANGES_REQUESTED
### Blocking Issues (must fix):
1. src/components/Button.tsx:42 — Missing null check on props.onClick — Severity: HIGH
2. src/lib/api.ts:15 — SQL injection in query builder — Severity: CRITICAL
### Suggestions (optional):
1. Consider extracting validation logic into shared util
</example>

IMPORTANT: "VERDICT: APPROVED" or "VERDICT: CHANGES_REQUESTED" must appear EXACTLY as shown.

At the END, also include:
\`\`\`verdict
{"approved": true/false, "blocking_count": N, "max_severity": "none|medium|high|critical"}
\`\`\`

## Common Mistakes to AVOID
- DO NOT block on style if it matches existing codebase
- DO NOT report pre-existing issues as new bugs
- DO NOT review without reading actual files
- DO NOT give APPROVED if you didn't read the changed files
</instructions>`,
};

// ─── Prompt Builders ────────────────────────────────────────

function truncateArtifact(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const headLen = Math.floor(maxLen * 0.7);
  const tailLen = maxLen - headLen;
  return text.substring(0, headLen) + `\n\n... (${text.length - maxLen}자 생략) ...\n\n` + text.substring(text.length - tailLen);
}

function buildChainPrompt(
  agent: AgentRow,
  tasks: TaskRow[],
  artifacts: Map<string, string>,
  mode: string,
  extraContext?: string
): string {
  // Use custom instruction if set, otherwise methodology prompt
  const methodology = agent.instruction
    ? `<instructions>\n${agent.instruction}\n</instructions>`
    : METHODOLOGY_PROMPTS[agent.role] ?? METHODOLOGY_PROMPTS.engineer;

  let prompt = methodology + "\n\n";

  // Tasks in XML structure
  prompt += `<tasks count="${tasks.length}">\n`;
  for (let i = 0; i < tasks.length; i++) {
    prompt += `<task index="${i + 1}" title="${tasks[i].title}">\n`;
    if (tasks[i].description) {
      prompt += `${tasks[i].description}\n`;
    }
    prompt += `</task>\n`;
  }
  prompt += `</tasks>\n\n`;

  prompt += `<execution-mode>${mode}</execution-mode>\n\n`;

  // Previous artifacts in XML
  if (artifacts.size > 0) {
    prompt += `<previous-results>\n`;
    for (const [role, artifact] of artifacts) {
      const truncated = truncateArtifact(artifact, MAX_ARTIFACT_LENGTH);
      prompt += `<artifact role="${role}">\n${truncated}\n</artifact>\n`;
    }
    prompt += `</previous-results>\n\n`;
  }

  // Extra context (build validation, rework feedback)
  if (extraContext) {
    prompt += `<context>\n${extraContext}\n</context>\n\n`;
  }

  return prompt;
}

function buildReworkPrompt(
  agent: AgentRow,
  tasks: TaskRow[],
  pmArtifact: string | undefined,
  engineerPrevOutput: string,
  reviewerFeedback: string,
  mode: string
): string {
  const methodology = agent.instruction
    ? `<instructions>\n${agent.instruction}\n</instructions>`
    : METHODOLOGY_PROMPTS.engineer;

  let prompt = methodology + "\n\n";

  prompt += `<rework-request>\n`;
  prompt += `The Reviewer found issues. Fix ALL blocking issues listed below.\n`;
  prompt += `</rework-request>\n\n`;

  prompt += `<tasks count="${tasks.length}">\n`;
  for (let i = 0; i < tasks.length; i++) {
    prompt += `<task index="${i + 1}" title="${tasks[i].title}">\n`;
    if (tasks[i].description) prompt += `${tasks[i].description}\n`;
    prompt += `</task>\n`;
  }
  prompt += `</tasks>\n\n`;

  prompt += `<execution-mode>${mode}</execution-mode>\n\n`;

  if (pmArtifact) {
    prompt += `<artifact role="pm">\n${truncateArtifact(pmArtifact, 30000)}\n</artifact>\n\n`;
  }

  prompt += `<artifact role="engineer-previous">\n${truncateArtifact(engineerPrevOutput, 30000)}\n</artifact>\n\n`;
  prompt += `<reviewer-feedback>\n${truncateArtifact(reviewerFeedback, 30000)}\n</reviewer-feedback>\n\n`;

  prompt += `Fix ALL blocking issues raised by the Reviewer. Keep working changes intact.`;

  return prompt;
}

/**
 * Build a shorter re-review prompt for Reviewer after Engineer rework
 */
function buildReReviewPrompt(
  agent: AgentRow,
  tasks: TaskRow[],
  reworkOutput: string,
  originalFeedback: string,
  buildResult?: string
): string {
  let prompt = `<instructions>
You are re-reviewing after the Engineer addressed your previous feedback.
Focus ONLY on whether the blocking issues you raised have been fixed.
Do NOT introduce new issues unless they are SECURITY or CORRECTNESS blockers.
Read the ACTUAL modified files to verify fixes.
End with VERDICT: APPROVED or VERDICT: CHANGES_REQUESTED.
</instructions>\n\n`;

  prompt += `<tasks count="${tasks.length}">\n`;
  for (let i = 0; i < tasks.length; i++) {
    prompt += `<task index="${i + 1}" title="${tasks[i].title}" />\n`;
  }
  prompt += `</tasks>\n\n`;

  prompt += `<your-previous-feedback>\n${truncateArtifact(originalFeedback, 20000)}\n</your-previous-feedback>\n\n`;
  prompt += `<engineer-rework>\n${truncateArtifact(reworkOutput, MAX_ARTIFACT_LENGTH)}\n</engineer-rework>\n\n`;

  if (buildResult) {
    prompt += `<context>\n${buildResult}\n</context>\n\n`;
  }

  // Use agent's custom instruction for system-level rules
  void agent;

  return prompt;
}

// ─── Validation Pipeline ────────────────────────────────────

async function runValidation(cwd: string): Promise<string> {
  const results: string[] = [];
  const nodeEnv = {
    ...process.env,
    PATH: `${process.env.HOME}/.nvm/versions/node/v22.22.0/bin:${process.env.PATH}`,
  };

  // 1. TypeScript type check (fast, catches most issues)
  try {
    execSync("npx tsc --noEmit 2>&1", { cwd, encoding: "utf-8", timeout: 60000, env: nodeEnv });
    results.push("### TypeCheck: PASSED");
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string };
    const output = ((e.stdout ?? "") + (e.stderr ?? "")).trim();
    const truncated = output.length > 3000 ? output.substring(0, 3000) + "..." : output;
    results.push(`### TypeCheck: FAILED\n\`\`\`\n${truncated}\n\`\`\``);
  }

  // 2. Build
  try {
    execSync("npm run build 2>&1", { cwd, encoding: "utf-8", timeout: 120000, env: nodeEnv });
    results.push("### Build: PASSED");
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string };
    const output = ((e.stdout ?? "") + (e.stderr ?? "")).trim();
    const truncated = output.length > 3000 ? output.substring(0, 3000) + "..." : output;
    results.push(`### Build: FAILED\n\`\`\`\n${truncated}\n\`\`\``);
  }

  // 3. Lint (non-blocking)
  try {
    execSync("npx eslint . --max-warnings 50 2>&1", { cwd, encoding: "utf-8", timeout: 60000, env: nodeEnv });
    results.push("### Lint: PASSED");
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string };
    const output = ((e.stdout ?? "") + (e.stderr ?? "")).trim();
    const truncated = output.length > 2000 ? output.substring(0, 2000) + "..." : output;
    results.push(`### Lint: WARNINGS/ERRORS\n\`\`\`\n${truncated}\n\`\`\``);
  }

  return results.join("\n\n");
}

// ─── Review Verdict Parsing ─────────────────────────────────

interface ReviewVerdict {
  approved: boolean;
  feedback: string;
}

function parseReviewVerdict(reviewerOutput: string): ReviewVerdict {
  // Try structured JSON verdict first
  const jsonMatch = reviewerOutput.match(/```verdict\s*\n([\s\S]*?)\s*\n```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (typeof parsed.approved === "boolean") {
        return {
          approved: parsed.approved,
          feedback: parsed.approved ? "" : extractFeedbackSection(reviewerOutput),
        };
      }
    } catch { /* fall through to text parsing */ }
  }

  const upperOutput = reviewerOutput.toUpperCase();

  if (upperOutput.includes("VERDICT: APPROVED") || upperOutput.includes("VERDICT:APPROVED")) {
    return { approved: true, feedback: "" };
  }

  if (
    upperOutput.includes("VERDICT: CHANGES_REQUESTED") ||
    upperOutput.includes("VERDICT:CHANGES_REQUESTED") ||
    upperOutput.includes("CHANGES REQUESTED") ||
    upperOutput.includes("BLOCKING ISSUES")
  ) {
    return { approved: false, feedback: extractFeedbackSection(reviewerOutput) };
  }

  // No explicit verdict — default to approved (don't force rework without clear signal)
  return { approved: true, feedback: "" };
}

function extractFeedbackSection(output: string): string {
  const verdictIdx = output.search(/VERDICT.*CHANGES_REQUESTED|CHANGES.REQUESTED|BLOCKING ISSUES/i);
  if (verdictIdx >= 0) {
    return output.substring(verdictIdx);
  }
  return output.substring(Math.max(0, output.length - 5000));
}

// ─── Artifact Loading ───────────────────────────────────────

async function loadPreviousArtifacts(
  supabase: SupabaseClient,
  pipelineId: string
): Promise<Map<string, string>> {
  const { data } = await supabase
    .from("agents")
    .select("role, config")
    .eq("pipeline_id", pipelineId);

  const artifacts = new Map<string, string>();
  if (data) {
    for (const row of data) {
      const config = row.config as { output_artifact?: string } | null;
      if (config?.output_artifact) {
        artifacts.set(row.role, config.output_artifact);
      }
    }
  }
  return artifacts;
}

// ─── Main Executor ──────────────────────────────────────────

export interface FollowUpContext {
  followUpPrompt: string;
  parentSessionId: string;
}

export async function runSimulator(
  pipelineId: string,
  sessionId: string,
  _options: SimulatorOptions = {},
  followUpContext?: FollowUpContext
): Promise<void> {
  activeSimulations.set(pipelineId, true);
  const supabase = createServiceClient();

  const [{ data: tasks }, { data: agents }, { data: pipeline }] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, description, order_index")
      .eq("pipeline_id", pipelineId)
      .order("order_index", { ascending: true }),
    supabase
      .from("agents")
      .select("id, role, name, instruction, model, config")
      .eq("pipeline_id", pipelineId),
    supabase
      .from("pipelines")
      .select("mode, config")
      .eq("id", pipelineId)
      .single(),
  ]);

  if (!tasks || tasks.length === 0 || !agents || agents.length === 0) {
    await insertLog(supabase, sessionId, agents?.[0]?.id ?? "", "system", "warn", "실행할 작업 또는 에이전트가 없습니다.");
    await completeSession(supabase, pipelineId, sessionId, 0);
    activeSimulations.delete(pipelineId);
    return;
  }

  const typedTasks = tasks as TaskRow[];
  const typedAgents = agents as AgentRow[];
  const pipelineMode = (pipeline?.mode as string) ?? "auto_edit";
  const pipelineConfig = (pipeline?.config as Record<string, unknown>) ?? {};
  const workingDir = pipelineConfig.working_dir as string | undefined;
  const pipelineCategory = (pipelineConfig.category as string) ?? "development";

  // ── General mode: sequential per-task execution ──
  if (pipelineCategory === "general") {
    await runGeneralMode(supabase, pipelineId, sessionId, typedTasks, typedAgents, pipelineConfig, followUpContext);
    return;
  }

  // ── Development mode: PM → Engineer → Reviewer chain ──

  // Sort agents by chainOrder, then filter by mode
  const allowedRoles = MODE_ROLE_FILTER[pipelineMode] ?? MODE_ROLE_FILTER.auto_edit;
  const sortedAgents = [...typedAgents]
    .filter(a => allowedRoles.has(a.role))
    .sort((a, b) => {
      const orderA = a.config?.chainOrder ?? defaultChainOrder(a.role);
      const orderB = b.config?.chainOrder ?? defaultChainOrder(b.role);
      return orderA - orderB;
    });

  if (sortedAgents.length === 0) {
    await insertLog(supabase, sessionId, typedAgents[0].id, "system", "warn",
      `모드 '${pipelineMode}'에 해당하는 에이전트가 없습니다.`);
    await completeSession(supabase, pipelineId, sessionId, 0);
    activeSimulations.delete(pipelineId);
    return;
  }

  const agentsByRole = new Map<string, AgentRow>();
  for (const agent of typedAgents) {
    agentsByRole.set(agent.role, agent);
  }

  const fallbackAgent = sortedAgents[0];
  let totalTokens = 0;
  const signal = { cancelled: false };

  try {
    // ── Follow-up mode ──
    if (followUpContext) {
      const agent = agentsByRole.get("engineer") ?? fallbackAgent;
      const prevArtifacts = await loadPreviousArtifacts(supabase, pipelineId);
      const prevLogContext = await buildFollowUpContext(supabase, followUpContext.parentSessionId);

      await supabase.from("agents").update({
        status: "active",
        current_task: followUpContext.followUpPrompt.substring(0, 100),
        progress: 0,
      }).eq("id", agent.id);

      await insertLog(supabase, sessionId, agent.id, agent.role, "info",
        `[FOLLOW-UP] ${followUpContext.followUpPrompt}`);

      const prompt = buildFollowUpPrompt(followUpContext.followUpPrompt, prevLogContext, prevArtifacts, agent);
      const systemPrompt = buildSystemPrompt(agent, pipelineConfig);
      totalTokens = await executeClaudeCLI(supabase, sessionId, agent, prompt, signal, {
        cwd: workingDir,
        systemPrompt,
        maxTurns: agent.config?.maxTurns ?? 25,
      });

      await supabase.from("agents").update({
        status: "idle", progress: 100, current_task: null,
      }).eq("id", agent.id);

      await insertLog(supabase, sessionId, agent.id, "system", "info",
        `후속 질의가 완료되었습니다. (약 ${totalTokens} 토큰 사용)`);
      await completeSession(supabase, pipelineId, sessionId, totalTokens);
      activeSimulations.delete(pipelineId);
      return;
    }

    // ── Chain execution with feedback loop ──
    const artifacts = new Map<string, string>();
    let totalPhases = sortedAgents.length;

    await insertLog(supabase, sessionId, fallbackAgent.id, "system", "info",
      `[CHAIN] 모드: ${pipelineMode} → ${sortedAgents.map(a => a.role.toUpperCase()).join(" → ")} (${typedTasks.length}개 작업)`);

    // Mark all tasks as in_progress
    await supabase
      .from("tasks")
      .update({ status: "in_progress" })
      .eq("pipeline_id", pipelineId);

    for (let phase = 0; phase < sortedAgents.length; phase++) {
      if (!activeSimulations.get(pipelineId)) {
        signal.cancelled = true;
        await cancelSession(supabase, pipelineId, sessionId, totalTokens);
        return;
      }

      const agent = sortedAgents[phase];
      const phaseLabel = `Phase ${phase + 1}/${totalPhases}`;

      await supabase.from("agents").update({
        status: "active",
        current_task: `${phaseLabel}: ${agent.role.toUpperCase()}`,
        progress: 0,
      }).eq("id", agent.id);

      await insertLog(supabase, sessionId, agent.id, agent.role, "info",
        `[CHAIN] ${phaseLabel}: ${agent.role.toUpperCase()} 시작 (${typedTasks.length}개 작업, 이전 artifact ${artifacts.size}개)`);

      // ── Validation before Reviewer ──
      let extraContext: string | undefined;
      if (agent.role === "reviewer" && workingDir) {
        await insertLog(supabase, sessionId, agent.id, "system", "info",
          `[VALIDATION] 빌드/타입/린트 검증 실행 중...`);
        const validationResult = await runValidation(workingDir);
        extraContext = validationResult;
        const hasFailed = validationResult.includes("FAILED");
        await insertLog(supabase, sessionId, agent.id, "system", "info",
          `[VALIDATION] ${hasFailed ? "일부 검증 실패 — Reviewer에게 전달" : "모든 검증 통과"}`);
      }

      // Build prompts: system (identity+rules) and user (methodology+tasks)
      const prompt = buildChainPrompt(agent, typedTasks, artifacts, pipelineMode, extraContext);
      const systemPrompt = buildSystemPrompt(agent, pipelineConfig);

      const { output, tokens } = await executeClaudeCLIChain(
        supabase, sessionId, agent, prompt, signal, {
          cwd: workingDir,
          systemPrompt,
          maxTurns: agent.config?.maxTurns ?? 25,
        }
      );
      totalTokens += tokens;

      if (output.length > 0) {
        artifacts.set(agent.role, output);
      }

      // Save artifact to DB
      const savedArtifact = output.length > MAX_ARTIFACT_SAVE_LENGTH
        ? output.substring(0, MAX_ARTIFACT_SAVE_LENGTH)
        : output;
      await supabase.from("agents").update({
        status: "idle",
        progress: 100,
        current_task: null,
        config: { ...agent.config, output_artifact: savedArtifact },
      }).eq("id", agent.id);

      // ── Feedback Loop: Reviewer → Engineer rework → Reviewer re-verify ──
      if (agent.role === "reviewer" && output.length > 0) {
        const verdict = parseReviewVerdict(output);

        if (!verdict.approved) {
          const engineerAgent = agentsByRole.get("engineer");
          if (engineerAgent) {
            for (let cycle = 0; cycle < MAX_REWORK_CYCLES; cycle++) {
              if (!activeSimulations.get(pipelineId)) {
                signal.cancelled = true;
                await cancelSession(supabase, pipelineId, sessionId, totalTokens);
                return;
              }

              totalPhases++;
              const reworkLabel = `Rework ${cycle + 1}/${MAX_REWORK_CYCLES}`;

              // ── Engineer rework ──
              await insertLog(supabase, sessionId, engineerAgent.id, "system", "info",
                `[FEEDBACK] Reviewer가 수정 요청 — ${reworkLabel} 시작`);

              await supabase.from("agents").update({
                status: "active",
                current_task: `${reworkLabel}: 수정 작업`,
                progress: 0,
              }).eq("id", engineerAgent.id);

              const reworkPrompt = buildReworkPrompt(
                engineerAgent, typedTasks,
                artifacts.get("pm"),
                artifacts.get("engineer") ?? "",
                verdict.feedback,
                pipelineMode
              );

              const reworkResult = await executeClaudeCLIChain(
                supabase, sessionId, engineerAgent, reworkPrompt, signal, {
                  cwd: workingDir,
                  systemPrompt: buildSystemPrompt(engineerAgent, pipelineConfig),
                  maxTurns: engineerAgent.config?.maxTurns ?? 30,
                }
              );
              totalTokens += reworkResult.tokens;

              if (reworkResult.output.length > 0) {
                artifacts.set("engineer", reworkResult.output);
              }

              const reworkSaved = reworkResult.output.length > MAX_ARTIFACT_SAVE_LENGTH
                ? reworkResult.output.substring(0, MAX_ARTIFACT_SAVE_LENGTH)
                : reworkResult.output;
              await supabase.from("agents").update({
                status: "idle", progress: 100, current_task: null,
                config: { ...engineerAgent.config, output_artifact: reworkSaved },
              }).eq("id", engineerAgent.id);

              await insertLog(supabase, sessionId, engineerAgent.id, engineerAgent.role, "info",
                `[FEEDBACK] ${reworkLabel} 완료 (${reworkResult.output.length}자)`);

              // ── Build re-validation ──
              let revalidation: string | undefined;
              if (workingDir) {
                revalidation = await runValidation(workingDir);
                const hasFailed = revalidation.includes("FAILED");
                await insertLog(supabase, sessionId, engineerAgent.id, "system", "info",
                  `[VALIDATION] 재검증: ${hasFailed ? "일부 실패" : "모든 검증 통과"}`);
              }

              // ── Reviewer re-verification ──
              totalPhases++;
              await insertLog(supabase, sessionId, agent.id, "system", "info",
                `[FEEDBACK] Reviewer 재검토 시작 (${reworkLabel} 결과)`);

              await supabase.from("agents").update({
                status: "active",
                current_task: `Re-review: ${reworkLabel}`,
                progress: 0,
              }).eq("id", agent.id);

              const reReviewPrompt = buildReReviewPrompt(
                agent, typedTasks,
                reworkResult.output,
                verdict.feedback,
                revalidation
              );

              const reReviewResult = await executeClaudeCLIChain(
                supabase, sessionId, agent, reReviewPrompt, signal, {
                  cwd: workingDir,
                  systemPrompt: buildSystemPrompt(agent, pipelineConfig),
                  maxTurns: 15,
                }
              );
              totalTokens += reReviewResult.tokens;

              if (reReviewResult.output.length > 0) {
                artifacts.set("reviewer", reReviewResult.output);
              }

              await supabase.from("agents").update({
                status: "idle", progress: 100, current_task: null,
                config: { ...agent.config, output_artifact: reReviewResult.output.substring(0, MAX_ARTIFACT_SAVE_LENGTH) },
              }).eq("id", agent.id);

              // Check re-review verdict
              const reVerdict = parseReviewVerdict(reReviewResult.output);
              if (reVerdict.approved) {
                await insertLog(supabase, sessionId, agent.id, agent.role, "info",
                  `[FEEDBACK] Reviewer APPROVED (${reworkLabel} 후)`);
                break;
              } else {
                await insertLog(supabase, sessionId, agent.id, agent.role, "info",
                  `[FEEDBACK] Reviewer 여전히 수정 요청 (cycle ${cycle + 1}/${MAX_REWORK_CYCLES})`);
                // Update feedback for next cycle
                Object.assign(verdict, { feedback: reVerdict.feedback });
              }
            }
          }
        } else {
          await insertLog(supabase, sessionId, agent.id, agent.role, "info",
            `[FEEDBACK] Reviewer APPROVED — 피드백 루프 불필요`);
        }
      }

      // Update session progress
      const progressPct = Math.round(((phase + 1) / sortedAgents.length) * 100);
      await supabase.from("sessions").update({
        token_usage: totalTokens,
        metadata: {
          progress_percent: progressPct,
          current_phase: phaseLabel,
          current_agent: agent.role,
        },
      }).eq("id", sessionId);

      await insertLog(supabase, sessionId, agent.id, agent.role, "info",
        `[CHAIN] ${phaseLabel}: ${agent.role.toUpperCase()} 완료 (artifact ${output.length}자)`);
    }

    // Mark all tasks as completed
    await supabase
      .from("tasks")
      .update({ status: "completed" })
      .eq("pipeline_id", pipelineId);

    await insertLog(supabase, sessionId, fallbackAgent.id, "system", "info",
      `모든 에이전트 체인이 완료되었습니다. (${totalPhases}개 phase, 약 ${totalTokens} 토큰 사용)`);
    await completeSession(supabase, pipelineId, sessionId, totalTokens);

  } catch (err) {
    console.error("[executor] Error during pipeline execution:", err);
    const errMsg = err instanceof Error ? err.message : String(err);
    await insertLog(supabase, sessionId, fallbackAgent.id, "system", "error",
      `파이프라인 실행 중 오류: ${errMsg}`);
    await failSession(supabase, pipelineId, sessionId, totalTokens);
  } finally {
    activeSimulations.delete(pipelineId);
  }
}

function defaultChainOrder(role: string): number {
  return { pm: 1, engineer: 2, reviewer: 3 }[role] ?? 2;
}

// ─── CLI Execution Helpers ──────────────────────────────────

async function executeClaudeCLIChain(
  supabase: SupabaseClient,
  sessionId: string,
  agent: AgentRow,
  prompt: string,
  signal: { cancelled: boolean },
  chainOptions?: { cwd?: string; systemPrompt?: string; maxTurns?: number; allowedTools?: string[] }
): Promise<{ output: string; tokens: number }> {
  await insertLog(supabase, sessionId, agent.id, agent.role, "debug",
    `[${agent.role.toUpperCase()}] Claude CLI 실행 중... (maxTurns: ${chainOptions?.maxTurns ?? 25})`);

  const allowedTools = chainOptions?.allowedTools?.length
    ? chainOptions.allowedTools
    : agent.config?.allowedTools?.length
    ? agent.config.allowedTools
    : DEFAULT_ALLOWED_TOOLS;
  const agentModel = agent.model ?? undefined;

  let chunkCount = 0;
  try {
    const { stdout, exitCode } = await runClaudeCLI(
      prompt,
      async (chunk) => {
        chunkCount++;
        const trimmed = chunk.trim();
        if (trimmed.length > 0 && chunkCount % 2 === 0) {
          const logMsg = trimmed.length > 300
            ? trimmed.substring(0, 300) + "..."
            : trimmed;
          await insertLog(supabase, sessionId, agent.id, agent.role, "debug",
            `[${agent.role.toUpperCase()}] ${logMsg}`);
        }
      },
      signal,
      {
        allowedTools,
        model: agentModel,
        maxTurns: chainOptions?.maxTurns ?? 25,
        cwd: chainOptions?.cwd,
        systemPrompt: chainOptions?.systemPrompt,
      }
    );

    const estimatedTokens = Math.ceil(stdout.length / 4);

    if (exitCode !== 0) {
      await insertLog(supabase, sessionId, agent.id, agent.role, "warn",
        `[${agent.role.toUpperCase()}] CLI 종료 코드: ${exitCode}`);
    }

    const hitMaxTurns = stdout.includes("Reached max turns") || stdout.includes("error_max_turns");
    if (hitMaxTurns) {
      await insertLog(supabase, sessionId, agent.id, agent.role, "warn",
        `[${agent.role.toUpperCase()}] 턴 제한 도달 — 부분 결과가 포함될 수 있습니다.`);
    }

    const cleanedOutput = stdout.replace(/Error: Reached max turns \(\d+\)\s*/g, "").trim();
    const isTruncated = cleanedOutput.length > 500;
    const resultSummary = isTruncated
      ? cleanedOutput.substring(0, 500) + `... (${cleanedOutput.length}자 총 출력)`
      : cleanedOutput;

    if (resultSummary.length > 0) {
      await insertLog(supabase, sessionId, agent.id, agent.role, "info",
        `[${agent.role.toUpperCase()}] 작업 완료: ${resultSummary}`,
        isTruncated ? { full_output: cleanedOutput } : undefined);
    } else {
      await insertLog(supabase, sessionId, agent.id, agent.role, "warn",
        `[${agent.role.toUpperCase()}] 작업 완료: 유효한 출력 없음`);
    }

    return { output: cleanedOutput, tokens: estimatedTokens };
  } catch (cliErr) {
    const errMsg = cliErr instanceof Error ? cliErr.message : String(cliErr);
    const isTimeout = errMsg.includes("timed out");
    await insertLog(supabase, sessionId, agent.id, agent.role, "error",
      `[${agent.role.toUpperCase()}] CLI 오류: ${errMsg}`);
    // Timeout and fatal errors must propagate to stop the chain — not silently continue
    if (isTimeout) {
      throw cliErr;
    }
    return { output: "", tokens: 0 };
  }
}

async function executeClaudeCLI(
  supabase: SupabaseClient,
  sessionId: string,
  agent: AgentRow,
  prompt: string,
  signal: { cancelled: boolean },
  chainOptions?: { cwd?: string; systemPrompt?: string; maxTurns?: number }
): Promise<number> {
  const { tokens } = await executeClaudeCLIChain(supabase, sessionId, agent, prompt, signal, chainOptions);
  return tokens;
}

// ─── Follow-Up Prompt ───────────────────────────────────────

function buildFollowUpPrompt(
  followUpRequest: string,
  prevLogContext: string,
  prevArtifacts: Map<string, string>,
  agent: AgentRow
): string {
  const methodology = agent.instruction
    ? agent.instruction
    : METHODOLOGY_PROMPTS.engineer;

  let prompt = `<instructions>\n${methodology}\n</instructions>\n\n`;

  if (prevArtifacts.size > 0) {
    prompt += `<previous-results>\n`;
    for (const [role, artifact] of prevArtifacts) {
      const truncated = truncateArtifact(artifact, MAX_ARTIFACT_LENGTH);
      prompt += `<artifact role="${role}">\n${truncated}\n</artifact>\n`;
    }
    prompt += `</previous-results>\n\n`;
  }

  prompt += `<context>\n${prevLogContext}\n</context>\n\n`;
  prompt += `<request>\n${followUpRequest}\n</request>\n\n`;
  prompt += "Based on the previous results, fulfill the follow-up request. You have full tool access.";

  return prompt;
}

async function buildFollowUpContext(
  supabase: SupabaseClient,
  parentSessionId: string
): Promise<string> {
  const { data: logs } = await supabase
    .from("agent_logs")
    .select("agent_role, level, message, metadata, created_at")
    .eq("session_id", parentSessionId)
    .in("level", ["info", "warn", "error"])
    .order("created_at", { ascending: true })
    .limit(50);

  const { data: changes } = await supabase
    .from("code_changes")
    .select("file_path, change_type, additions, deletions")
    .eq("session_id", parentSessionId);

  let context = "";

  if (logs && logs.length > 0) {
    context += "### Execution Results\n";
    for (const log of logs) {
      const fullOutput = (log.metadata as Record<string, unknown>)?.full_output;
      const content = typeof fullOutput === "string" ? fullOutput : log.message;
      const capped = content.length > 2000 ? content.substring(0, 2000) + "..." : content;
      context += `\n#### [${log.level.toUpperCase()}] ${log.agent_role}\n${capped}\n`;
    }
  }

  if (changes && changes.length > 0) {
    context += "\n### Code Changes\n";
    for (const c of changes) {
      context += `- ${c.change_type}: ${c.file_path} (+${c.additions ?? 0}/-${c.deletions ?? 0})\n`;
    }
  }

  return context || "No previous execution data available.";
}

// ─── General Mode Executor ──────────────────────────────────

const GENERAL_SYSTEM_PROMPT = `You are a versatile AI agent that executes tasks precisely and thoroughly.
You follow instructions exactly. You have access to tools for reading files, searching code, writing documents, and accessing external services.

## CONSTRAINTS
- Focus ONLY on the current task. Do not work on other tasks.
- Use available tools actively to complete the task.
- When analyzing code: read actual files, don't guess.
- When writing documents: use proper structure and formatting.
- Language: Respond in Korean unless the task explicitly requires another language.`;

async function runGeneralMode(
  supabase: SupabaseClient,
  pipelineId: string,
  sessionId: string,
  tasks: TaskRow[],
  agents: AgentRow[],
  pipelineConfig: Record<string, unknown>,
  followUpContext?: FollowUpContext
): Promise<void> {
  activeSimulations.set(pipelineId, true);
  const signal = { cancelled: false };
  let totalTokens = 0;

  // Use engineer agent as the executor (broadest tool access)
  const executor = agents.find(a => a.role === "engineer") ?? agents[0];
  const allowedTools = executor.config?.allowedTools?.length
    ? executor.config.allowedTools
    : DEFAULT_ALLOWED_TOOLS;
  const workingDir = pipelineConfig.working_dir as string | undefined;

  try {
    await insertLog(supabase, sessionId, executor.id, "system", "info",
      `[GENERAL] 범용 모드 시작 — ${tasks.length}개 작업을 순차 실행합니다.`);

    // Mark all tasks as pending initially
    await supabase.from("tasks").update({ status: "pending" }).eq("pipeline_id", pipelineId);

    // Handle follow-up context
    if (followUpContext) {
      const prevArtifacts = await loadPreviousArtifacts(supabase, pipelineId);
      const prevLogContext = await buildFollowUpContext(supabase, followUpContext.parentSessionId);

      await supabase.from("agents").update({
        status: "active",
        current_task: followUpContext.followUpPrompt.substring(0, 100),
        progress: 0,
      }).eq("id", executor.id);

      const prompt = buildFollowUpPrompt(followUpContext.followUpPrompt, prevLogContext, prevArtifacts, executor);

      const { output, tokens } = await executeClaudeCLIChain(
        supabase, sessionId, executor, prompt, signal, {
          cwd: workingDir,
          systemPrompt: GENERAL_SYSTEM_PROMPT,
          maxTurns: executor.config?.maxTurns ?? 25,
        }
      );
      totalTokens += tokens;

      const savedArtifact = output.substring(0, MAX_ARTIFACT_SAVE_LENGTH);
      await supabase.from("agents").update({
        status: "idle", progress: 100, current_task: null,
        config: { ...executor.config, output_artifact: savedArtifact },
      }).eq("id", executor.id);

      await completeSession(supabase, pipelineId, sessionId, totalTokens);
      activeSimulations.delete(pipelineId);
      return;
    }

    // ── Sequential task execution ──
    const taskResults: string[] = [];

    for (let i = 0; i < tasks.length; i++) {
      if (!activeSimulations.get(pipelineId)) {
        signal.cancelled = true;
        await cancelSession(supabase, pipelineId, sessionId, totalTokens);
        return;
      }

      const task = tasks[i];
      const progressPct = Math.round((i / tasks.length) * 100);

      // Update task + agent status
      await supabase.from("tasks").update({ status: "in_progress" }).eq("id", task.id);
      await supabase.from("agents").update({
        status: "active",
        current_task: `Task ${i + 1}/${tasks.length}: ${task.title}`,
        progress: progressPct,
      }).eq("id", executor.id);

      await insertLog(supabase, sessionId, executor.id, executor.role, "info",
        `[GENERAL] Task ${i + 1}/${tasks.length} 시작: ${task.title}`);

      // Build per-task prompt with previous results as context
      // Strategy: full output for the immediately previous task, summaries for older ones
      // This keeps context manageable (~40K max) instead of unbounded accumulation
      let prompt = `<task title="${task.title}">\n${task.description ?? task.title}\n</task>\n\n`;

      if (taskResults.length > 0) {
        prompt += `<previous-results>\n`;
        for (let j = 0; j < taskResults.length; j++) {
          const isLastResult = j === taskResults.length - 1;
          if (isLastResult) {
            // Most recent task: full output (truncated to 30K)
            const fullResult = truncateArtifact(taskResults[j], 30000);
            prompt += `<result task="${tasks[j].title}" type="full">\n${fullResult}\n</result>\n`;
          } else {
            // Older tasks: first 2000 chars as summary
            const summary = taskResults[j].substring(0, 2000)
              + (taskResults[j].length > 2000 ? `\n... (${taskResults[j].length}자 중 요약)` : "");
            prompt += `<result task="${tasks[j].title}" type="summary">\n${summary}\n</result>\n`;
          }
        }
        prompt += `</previous-results>\n\n`;
      }

      prompt += `Complete the task above. Use tools as needed. Output your results clearly.`;

      // Execute CLI for this single task
      const { output, tokens } = await executeClaudeCLIChain(
        supabase, sessionId, executor, prompt, signal, {
          allowedTools,
          cwd: workingDir,
          systemPrompt: GENERAL_SYSTEM_PROMPT,
          maxTurns: executor.config?.maxTurns ?? 25,
        }
      );
      totalTokens += tokens;

      // Store result for next task's context
      taskResults.push(output);

      // Mark task completed
      await supabase.from("tasks").update({ status: "completed" }).eq("id", task.id);

      await insertLog(supabase, sessionId, executor.id, executor.role, "info",
        `[GENERAL] Task ${i + 1}/${tasks.length} 완료: ${task.title} (${output.length}자)`);

      // Update session progress
      await supabase.from("sessions").update({
        token_usage: totalTokens,
        metadata: {
          progress_percent: Math.round(((i + 1) / tasks.length) * 100),
          current_task: task.title,
        },
      }).eq("id", sessionId);
    }

    // Save combined artifact
    const combinedArtifact = taskResults.join("\n\n---\n\n");
    const savedArtifact = combinedArtifact.substring(0, MAX_ARTIFACT_SAVE_LENGTH);
    await supabase.from("agents").update({
      status: "idle", progress: 100, current_task: null,
      config: { ...executor.config, output_artifact: savedArtifact },
    }).eq("id", executor.id);

    // Idle all other agents
    for (const agent of agents) {
      if (agent.id !== executor.id) {
        await supabase.from("agents").update({
          status: "idle", progress: 100, current_task: null,
        }).eq("id", agent.id);
      }
    }

    await insertLog(supabase, sessionId, executor.id, "system", "info",
      `[GENERAL] 모든 작업 완료 (${tasks.length}개 작업, 약 ${totalTokens} 토큰 사용)`);
    await completeSession(supabase, pipelineId, sessionId, totalTokens);

  } catch (err) {
    console.error("[general-executor] Error:", err);
    const errMsg = err instanceof Error ? err.message : String(err);
    await insertLog(supabase, sessionId, executor.id, "system", "error",
      `[GENERAL] 실행 중 오류: ${errMsg}`);
    await failSession(supabase, pipelineId, sessionId, totalTokens);
  } finally {
    activeSimulations.delete(pipelineId);
  }
}

// ─── Session Management ─────────────────────────────────────

async function completeSession(
  supabase: SupabaseClient, pipelineId: string, sessionId: string, totalTokens: number
): Promise<void> {
  await supabase.from("sessions").update({
    status: "completed",
    token_usage: totalTokens,
    completed_at: new Date().toISOString(),
    metadata: { progress_percent: 100 },
  }).eq("id", sessionId);

  await supabase.from("pipelines").update({
    status: "completed",
    completed_at: new Date().toISOString(),
  }).eq("id", pipelineId);

  triggerCleanupCheck(supabase);
}

async function failSession(
  supabase: SupabaseClient, pipelineId: string, sessionId: string, totalTokens: number
): Promise<void> {
  await supabase.from("sessions").update({
    status: "failed",
    token_usage: totalTokens,
    completed_at: new Date().toISOString(),
    metadata: { error: "Execution failed" },
  }).eq("id", sessionId);

  await supabase.from("pipelines").update({
    status: "failed",
    completed_at: new Date().toISOString(),
  }).eq("id", pipelineId);
}

async function cancelSession(
  supabase: SupabaseClient, pipelineId: string, sessionId: string, totalTokens: number
): Promise<void> {
  await supabase.from("sessions").update({
    status: "cancelled",
    token_usage: totalTokens,
    completed_at: new Date().toISOString(),
  }).eq("id", sessionId);

  await supabase.from("pipelines").update({
    status: "cancelled",
    completed_at: new Date().toISOString(),
  }).eq("id", pipelineId);
}

function triggerCleanupCheck(supabase: SupabaseClient): void {
  Promise.resolve(supabase.rpc("cleanup_old_logs", { threshold_mb: 400, delete_mb: 100 }))
    .then(({ data, error }) => {
      if (error) {
        console.warn("[cleanup] RPC failed:", error.message);
        return;
      }
      const result = data?.[0];
      if (result?.deleted_count > 0) {
        console.log(`[cleanup] Deleted ${result.deleted_count} old logs (DB was ${result.db_size_mb}MB)`);
      }
    })
    .catch(() => { /* ignore cleanup failures */ });
}
