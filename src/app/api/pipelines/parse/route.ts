import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { successResponse, handleError } from "@/lib/api/response";
import { Errors, AppError } from "@/lib/api/errors";

const MAX_INPUT_LENGTH = 2000;
const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-sonnet-4-5-20250514";
const CLAUDE_TIMEOUT_MS = 30_000;

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

    // Get Claude API key: user_settings first, then env fallback
    const apiKey = await getApiKey(supabase, user.id);

    // Call Claude API with retry on JSON parse failure
    const parsed = await callClaudeWithRetry(apiKey, input.trim());

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

async function getApiKey(
  supabase: Awaited<ReturnType<typeof getAuthenticatedUser>>["supabase"],
  userId: string
): Promise<string> {
  const { data: settings } = await supabase
    .from("user_settings")
    .select("api_keys")
    .eq("user_id", userId)
    .single();

  const userKey =
    settings?.api_keys &&
    typeof settings.api_keys === "object" &&
    "claude_api_key" in (settings.api_keys as Record<string, unknown>)
      ? (settings.api_keys as Record<string, string>).claude_api_key
      : null;

  const apiKey = userKey || process.env.CLAUDE_API_KEY;

  if (!apiKey) {
    throw Errors.badRequest(
      "Claude API key not configured. Set it in user settings or contact the administrator."
    );
  }

  return apiKey;
}

async function callClaudeWithRetry(
  apiKey: string,
  input: string,
  retries = 1
): Promise<ClaudeParseResult> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const raw = await callClaudeAPI(apiKey, input);
    const parsed = tryParseJSON(raw);
    if (parsed) return parsed;

    if (attempt < retries) {
      // Retry with stricter prompt
      continue;
    }
  }

  throw Errors.unprocessable("Failed to parse Claude API response as valid JSON");
}

async function callClaudeAPI(apiKey: string, input: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CLAUDE_TIMEOUT_MS);

  try {
    const response = await fetch(CLAUDE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: input }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "Unknown error");

      if (response.status === 401) {
        throw Errors.badRequest("Invalid Claude API key");
      }
      if (response.status === 429) {
        throw new AppError(502, "Claude API rate limit exceeded. Please try again later.", "UPSTREAM_ERROR");
      }

      throw new AppError(502, `Claude API error (${response.status}): ${errorBody}`, "UPSTREAM_ERROR");
    }

    const data = await response.json();
    const textBlock = data.content?.find(
      (block: { type: string; text?: string }) => block.type === "text"
    );

    if (!textBlock?.text) {
      throw Errors.unprocessable("Claude API returned an empty response");
    }

    return textBlock.text;
  } catch (err) {
    if (err instanceof AppError) throw err;

    if (err instanceof DOMException && err.name === "AbortError") {
      throw new AppError(502, "Claude API request timed out", "UPSTREAM_TIMEOUT");
    }

    throw new AppError(502, "Failed to connect to Claude API", "UPSTREAM_ERROR");
  } finally {
    clearTimeout(timeout);
  }
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

