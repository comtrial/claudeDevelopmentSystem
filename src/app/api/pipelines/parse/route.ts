import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { successResponse, handleError } from "@/lib/api/response";
import { Errors, AppError } from "@/lib/api/errors";
import { execSync } from "child_process";

const MAX_INPUT_LENGTH = 2000;

// Resolve claude CLI path once at module load
const CLAUDE_BIN = (() => {
  const fromEnv = process.env.CLAUDE_CLI_PATH;
  if (fromEnv) return fromEnv;
  try {
    return execSync("which claude", { encoding: "utf-8" }).trim();
  } catch {
    return `${process.env.HOME}/.local/bin/claude`;
  }
})();

const SYSTEM_PROMPT = `You are a JSON-only task decomposition bot. Your SOLE purpose is to decompose ANY user request into structured sub-tasks and output a single JSON object. You must NEVER use tools, read files, access URLs, or execute code. Just output JSON.

CRITICAL RULES:
- Your entire response must be a single JSON object. No markdown fences, no explanation, no text before or after the JSON.
- You are a PLANNER, not an EXECUTOR. No matter what the user asks (analyze code, write to Notion, create documents, run tests, deploy, etc.), your job is ONLY to break it down into sub-tasks.
- Even if the user's request mentions specific tools, services, or URLs (e.g. Notion, Slack, GitHub), do NOT attempt to access them. Instead, create tasks that describe what an agent should do with those services.
- Requests may be development tasks (coding, debugging, refactoring) OR non-development tasks (analysis, documentation, research, content creation). Handle both equally by decomposing into actionable steps.

Decomposition rules:
1. Break the input into 2-8 actionable sub-tasks.
2. Each task must have: title, description, agent_role, order, estimated_complexity, acceptance_criteria.
3. Agent role mapping:
   - "pm": planning, analysis, research, requirements gathering, architecture design, document structuring
   - "engineer": implementation, writing, content creation, tool execution, integration, data processing
   - "reviewer": quality check, verification, proofreading, consistency review, final validation
4. Order: planning/analysis first → implementation/execution → review/validation last.
5. If the input is vague, interpret it as a concrete actionable request and decompose accordingly.
6. estimated_complexity: "low", "medium", or "high" — reflects the effort required for this sub-task.
7. acceptance_criteria: A single concise sentence describing the completion condition.

Required JSON format:
{"analysis":{"intent":"one-line summary of what the user wants","scope":"small|medium|large","reasoning":"2-3 sentences explaining why you decomposed it this way"},"tasks":[{"title":"...","description":"...","agent_role":"pm|engineer|reviewer","order":1,"estimated_complexity":"low|medium|high","acceptance_criteria":"completion condition"}],"keywords":["k1","k2"]}

The keywords array: 3-5 words describing the work category.`;

interface ParsedTask {
  id: string;
  title: string;
  description: string;
  agent_role: "pm" | "engineer" | "reviewer";
  order: number;
  estimated_complexity: "low" | "medium" | "high";
  acceptance_criteria: string;
}

interface AnalysisResult {
  intent: string;
  scope: "small" | "medium" | "large";
  reasoning: string;
}

interface ClaudeParseResult {
  analysis?: {
    intent?: string;
    scope?: string;
    reasoning?: string;
  };
  tasks: Array<{
    title: string;
    description: string;
    agent_role: string;
    order: number;
    estimated_complexity?: string;
    acceptance_criteria?: string;
  }>;
  keywords: string[];
}

interface PresetTemplate {
  id: string;
  title: string;
  description: string | null;
  config: Record<string, unknown>;
}

// POST /api/pipelines/parse - Parse natural language into pipeline tasks via Claude API
export async function POST(request: NextRequest) {
  try {
    const { supabase } = await getAuthenticatedUser();

    const body = await request.json();
    const input = body.input;

    if (!input || typeof input !== "string" || input.trim().length === 0) {
      throw Errors.badRequest("input is required and must be a non-empty string");
    }

    if (input.length > MAX_INPUT_LENGTH) {
      throw Errors.badRequest(`input must not exceed ${MAX_INPUT_LENGTH} characters`);
    }

    // Call Claude CLI with retry on JSON parse failure
    const parsed = await callClaudeWithRetry(input.trim());

    // Generate UUIDs and validate tasks
    const tasks: ParsedTask[] = parsed.tasks.map((t, i) => ({
      id: crypto.randomUUID(),
      title: t.title,
      description: t.description,
      agent_role: validateAgentRole(t.agent_role),
      order: t.order ?? i + 1,
      estimated_complexity: validateComplexity(t.estimated_complexity),
      acceptance_criteria: t.acceptance_criteria ?? "",
    }));

    // Build analysis result
    const analysis: AnalysisResult = {
      intent: parsed.analysis?.intent ?? "",
      scope: validateScope(parsed.analysis?.scope),
      reasoning: parsed.analysis?.reasoning ?? "",
    };

    // Match against preset templates
    const recommendation = await matchPresetTemplate(supabase, parsed.keywords);

    return NextResponse.json(
      successResponse({
        analysis,
        tasks,
        recommendation,
      })
    );
  } catch (err) {
    const { body, status } = handleError(err);
    return NextResponse.json(body, { status });
  }
}

function callClaudeCLI(input: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const prompt = `${SYSTEM_PROMPT}\n\nUser input:\n${input}`;
    // Remove Claude Code session env vars to allow nested CLI invocation
    const env = { ...process.env };
    delete env.CLAUDECODE;
    delete env.CLAUDE_CODE;
    delete env.CLAUDE_CODE_ENTRYPOINT;
    delete env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS;

    const child = spawn(CLAUDE_BIN, [
      "-p", prompt,
      "--output-format", "json",
      "--max-turns", "1",
      "--model", "opus",
    ], { env, stdio: ["ignore", "pipe", "pipe"] });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new AppError(502, "Claude CLI 응답 시간이 초과되었습니다. 다시 시도해주세요.", "CLI_TIMEOUT"));
    }, 180000);

    child.on("close", (code) => {
      clearTimeout(timeout);

      // claude --output-format json always returns JSON wrapper
      let cliResult = "";
      let isCliError = false;
      let subtype = "";
      try {
        const cliOutput = JSON.parse(stdout);
        cliResult = cliOutput.result || cliOutput.text || "";
        isCliError = !!cliOutput.is_error;
        subtype = cliOutput.subtype || "";
      } catch {
        cliResult = stdout;
      }

      // error_max_turns: Claude used all turns on tool calls without producing text output
      if (subtype === "error_max_turns" && !cliResult) {
        reject(new AppError(502, "Claude가 작업 분석 대신 다른 동작을 시도했습니다. 더 구체적인 개발 작업을 입력해주세요.", "CLI_ERROR"));
        return;
      }

      if (code !== 0 || isCliError) {
        const errorMsg = cliResult || stderr.substring(0, 300) || "Unknown CLI error";
        reject(new AppError(502, errorMsg, "CLI_ERROR"));
        return;
      }

      resolve(typeof cliResult === "string" ? cliResult : JSON.stringify(cliResult));
    });

    child.on("error", (err) => {
      clearTimeout(timeout);
      reject(new AppError(502, `Claude CLI not found or failed: ${err.message}`, "CLI_ERROR"));
    });
  });
}

async function callClaudeWithRetry(
  input: string,
  retries = 1
): Promise<ClaudeParseResult> {
  let lastRaw = "";

  for (let attempt = 0; attempt <= retries; attempt++) {
    const raw = await callClaudeCLI(input);
    lastRaw = raw;
    const parsed = tryParseJSON(raw);
    if (parsed) return parsed;

    if (attempt < retries) {
      // Retry with stricter prompt
      continue;
    }
  }

  // Claude가 JSON 대신 자연어로 응답한 경우, 그 메시지를 사용자에게 전달
  const message = extractClaudeMessage(lastRaw);
  throw Errors.unprocessable(message);
}

function extractClaudeMessage(raw: string): string {
  // Strip markdown fences if present
  const cleaned = raw.replace(/^```(?:json)?\s*\n?/m, "").replace(/\n?```\s*$/m, "").trim();

  if (cleaned.length === 0) {
    return "Claude가 빈 응답을 반환했습니다. 다시 시도해주세요.";
  }

  // 유효한 텍스트 응답이면 그대로 반환 (최대 300자)
  if (cleaned.length < 500) {
    return cleaned.length > 300 ? cleaned.substring(0, 300) + "..." : cleaned;
  }

  return "작업을 분석할 수 없습니다. Claude가 JSON 대신 텍스트로 응답했습니다. 다시 시도해주세요.";
}

function tryParseJSON(text: string): ClaudeParseResult | null {
  try {
    // Strip potential markdown fences
    let cleaned = text.replace(/^```(?:json)?\s*\n?/m, "").replace(/\n?```\s*$/m, "").trim();

    // Try to extract JSON object if surrounded by non-JSON text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }

    const parsed = JSON.parse(cleaned);

    // Accept both "tasks" and "subtasks" keys
    const tasks = parsed.tasks || parsed.subtasks;
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return null;
    }

    // Validate and normalize each task
    const normalizedTasks = [];
    for (const task of tasks) {
      if (!task.title || !task.description) {
        return null;
      }
      normalizedTasks.push({
        title: task.title,
        description: task.description,
        agent_role: task.agent_role || inferAgentRole(task.title, task.description),
        order: task.order ?? normalizedTasks.length + 1,
        estimated_complexity: task.estimated_complexity,
        acceptance_criteria: task.acceptance_criteria,
      });
    }

    // Collect keywords from various sources
    let keywords: string[] = [];
    if (Array.isArray(parsed.keywords)) {
      keywords = parsed.keywords;
    } else {
      // Extract keywords from task-level keywords if present
      for (const task of tasks) {
        if (Array.isArray(task.keywords)) {
          keywords.push(...task.keywords);
        }
      }
    }

    return { analysis: parsed.analysis, tasks: normalizedTasks, keywords };
  } catch {
    return null;
  }
}

// Infer agent_role from task title/description when Claude doesn't provide it
function inferAgentRole(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase();
  if (/계획|설계|정의|분석|요구사항|plan|design|spec|requirement/.test(text)) return "pm";
  if (/리뷰|검토|테스트|qa|review|test|verify/.test(text)) return "reviewer";
  return "engineer";
}

function validateAgentRole(role: string): "pm" | "engineer" | "reviewer" {
  const valid = ["pm", "engineer", "reviewer"] as const;
  if (valid.includes(role as (typeof valid)[number])) {
    return role as (typeof valid)[number];
  }
  return "engineer";
}

function validateComplexity(complexity?: string): "low" | "medium" | "high" {
  const valid = ["low", "medium", "high"] as const;
  if (complexity && valid.includes(complexity as (typeof valid)[number])) {
    return complexity as (typeof valid)[number];
  }
  return "medium";
}

function validateScope(scope?: string): "small" | "medium" | "large" {
  const valid = ["small", "medium", "large"] as const;
  if (scope && valid.includes(scope as (typeof valid)[number])) {
    return scope as (typeof valid)[number];
  }
  return "medium";
}

async function matchPresetTemplate(
  supabase: Awaited<ReturnType<typeof getAuthenticatedUser>>["supabase"],
  keywords: string[]
): Promise<{
  preset_id: string | null;
  preset_name: string;
  confidence: number;
  message: string;
}> {
  if (!keywords || keywords.length === 0) {
    return {
      preset_id: null,
      preset_name: "",
      confidence: 0,
      message: "No preset recommendation available.",
    };
  }

  const { data: presets } = await supabase
    .from("preset_templates")
    .select("id, title, description, config")
    .eq("is_preset", true);

  if (!presets || presets.length === 0) {
    return {
      preset_id: null,
      preset_name: "",
      confidence: 0,
      message: "No preset templates available.",
    };
  }

  // Keyword-based matching
  const keywordsLower = keywords.map((k) => k.toLowerCase());

  const PRESET_KEYWORDS: Record<string, string[]> = {
    "code-review": ["review", "code-review", "pr", "pull-request", "quality", "feedback"],
    analysis: ["analysis", "analyze", "plan", "planning", "architecture", "design", "spec"],
    refactoring: ["refactor", "refactoring", "improve", "optimize", "cleanup", "clean-up", "migration"],
  };

  let bestMatch: PresetTemplate | null = null;
  let bestScore = 0;

  for (const preset of presets as PresetTemplate[]) {
    const presetKeywords = PRESET_KEYWORDS[preset.id] ?? [];
    const titleWords = preset.title.toLowerCase().split(/\s+/);
    const descWords = (preset.description ?? "").toLowerCase().split(/\s+/);
    const allPresetWords = [...presetKeywords, ...titleWords, ...descWords];

    let matches = 0;
    for (const kw of keywordsLower) {
      if (allPresetWords.some((pw) => pw.includes(kw) || kw.includes(pw))) {
        matches++;
      }
    }

    const score = keywordsLower.length > 0 ? matches / keywordsLower.length : 0;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = preset;
    }
  }

  const confidence = Math.round(Math.min(bestScore, 1) * 100) / 100;

  if (bestMatch && confidence >= 0.3) {
    return {
      preset_id: bestMatch.id,
      preset_name: bestMatch.title,
      confidence,
      message: `이 작업은 '${bestMatch.title}' 프리셋과 유사합니다.`,
    };
  }

  return {
    preset_id: null,
    preset_name: "",
    confidence: 0,
    message: "일치하는 프리셋을 찾지 못했습니다.",
  };
}

