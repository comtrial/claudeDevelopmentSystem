import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { successResponse, handleError } from "@/lib/api/response";
import { Errors, AppError } from "@/lib/api/errors";

const MAX_INPUT_LENGTH = 2000;

const SYSTEM_PROMPT = `You are a development task decomposition assistant. Your job is to analyze a natural language description of a development task and break it down into ordered sub-tasks.

Rules:
1. Decompose the input into 2-8 concrete, actionable sub-tasks.
2. Each task must have a clear title and description.
3. Assign each task an agent_role: "pm" (planning, specs, requirements), "engineer" (implementation, coding), or "reviewer" (code review, testing, QA).
4. Order tasks logically (planning first, then implementation, then review).
5. Output ONLY valid JSON — no markdown fences, no explanation, no extra text.

Output format:
{
  "tasks": [
    {
      "title": "short task title",
      "description": "detailed description of what this task involves",
      "agent_role": "pm|engineer|reviewer",
      "order": 1
    }
  ],
  "keywords": ["keyword1", "keyword2"]
}

The "keywords" array should contain 3-5 keywords that best describe the overall work category (e.g., "refactoring", "code-review", "analysis", "feature", "testing", "bug-fix").`;

interface ParsedTask {
  id: string;
  title: string;
  description: string;
  agent_role: "pm" | "engineer" | "reviewer";
  order: number;
}

interface ClaudeParseResult {
  tasks: Array<{
    title: string;
    description: string;
    agent_role: string;
    order: number;
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
    const { supabase, user } = await getAuthenticatedUser();

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
    }));

    // Match against preset templates
    const recommendation = await matchPresetTemplate(supabase, parsed.keywords);

    return NextResponse.json(
      successResponse({
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
    const child = spawn("claude", [
      "-p", prompt,
      "--output-format", "json",
      "--max-turns", "1",
      "--model", "sonnet",
    ]);

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new AppError(502, "Claude CLI request timed out", "CLI_TIMEOUT"));
    }, 30000);

    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new AppError(502, `Claude CLI exited with code ${code}: ${stderr}`, "CLI_ERROR"));
        return;
      }
      // Parse the JSON output from claude CLI
      try {
        const cliOutput = JSON.parse(stdout);
        // claude --output-format json returns { result: "text content", ... }
        const text = cliOutput.result || cliOutput.text || stdout;
        resolve(typeof text === "string" ? text : JSON.stringify(text));
      } catch {
        // If not JSON wrapper, use raw stdout
        resolve(stdout);
      }
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
  for (let attempt = 0; attempt <= retries; attempt++) {
    const raw = await callClaudeCLI(input);
    const parsed = tryParseJSON(raw);
    if (parsed) return parsed;

    if (attempt < retries) {
      // Retry with stricter prompt
      continue;
    }
  }

  throw Errors.unprocessable("Failed to parse Claude CLI response as valid JSON");
}

function tryParseJSON(text: string): ClaudeParseResult | null {
  try {
    // Strip potential markdown fences
    const cleaned = text.replace(/^```(?:json)?\s*\n?/m, "").replace(/\n?```\s*$/m, "").trim();
    const parsed = JSON.parse(cleaned);

    if (!parsed.tasks || !Array.isArray(parsed.tasks) || parsed.tasks.length === 0) {
      return null;
    }

    // Validate each task has required fields
    for (const task of parsed.tasks) {
      if (!task.title || !task.description || !task.agent_role) {
        return null;
      }
    }

    return {
      tasks: parsed.tasks,
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
    };
  } catch {
    return null;
  }
}

function validateAgentRole(role: string): "pm" | "engineer" | "reviewer" {
  const valid = ["pm", "engineer", "reviewer"] as const;
  if (valid.includes(role as (typeof valid)[number])) {
    return role as (typeof valid)[number];
  }
  return "engineer";
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

