import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { successResponse, handleError } from "@/lib/api/response";
import { Errors } from "@/lib/api/errors";
import type { PipelineSummary } from "@/types/pipeline-summary";
import type { PipelineStatus, PipelineMode } from "@/types/pipeline";

const VALID_STATUSES = new Set<string>(["running", "completed", "failed", "all"]);
const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 10;

const STATUS_SORT_ORDER: Record<string, number> = {
  running: 0,
  paused: 1,
  draft: 2,
  failed: 3,
  completed: 4,
  cancelled: 5,
};

interface PipelineRow {
  id: string;
  title: string;
  description: string | null;
  status: PipelineStatus;
  mode: PipelineMode;
  created_at: string;
  updated_at: string;
  agents: { id: string; role: string }[];
  tasks: { id: string; status: string }[];
  sessions: { id: string; status: string; token_usage: number; token_limit: number }[];
}

// GET /api/pipelines - List user's pipelines with agent/session summaries
export async function GET(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthenticatedUser();

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status") ?? "all";
    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, 1),
      MAX_LIMIT
    );
    const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10) || 0, 0);

    if (!VALID_STATUSES.has(statusFilter)) {
      throw Errors.badRequest(`Invalid status filter: ${statusFilter}`);
    }

    let query = supabase
      .from("pipelines")
      .select("id, title, description, status, mode, created_at, updated_at, agents(id, role), tasks(id, status), sessions(id, status, token_usage, token_limit)")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    // Fetch with extra room for sorting
    const { data: rows, error: dbError } = await query;

    if (dbError) {
      throw Errors.internal(dbError.message);
    }

    const pipelines = (rows as PipelineRow[]) ?? [];

    // Sort: running first, then by updated_at desc
    const sorted = pipelines.sort((a, b) => {
      const orderA = STATUS_SORT_ORDER[a.status] ?? 99;
      const orderB = STATUS_SORT_ORDER[b.status] ?? 99;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

    // Apply pagination
    const paginated = sorted.slice(offset, offset + limit);

    const result: PipelineSummary[] = paginated.map((p) => {
      const roles = [...new Set(p.agents.map((a) => a.role))];

      // Build task summary counts
      const tasks = p.tasks ?? [];
      const taskSummary = {
        total: tasks.length,
        completed: tasks.filter((t) => t.status === "completed").length,
        in_progress: tasks.filter((t) => t.status === "in_progress").length,
        failed: tasks.filter((t) => t.status === "failed").length,
        pending: tasks.filter((t) => t.status === "pending" || t.status === "skipped").length,
      };

      // Pick latest session by finding the one with the most recent data
      // Sessions come ordered by default; pick first as latest
      const latestSession = p.sessions.length > 0 ? p.sessions[0] : null;

      return {
        id: p.id,
        title: p.title,
        description: p.description,
        status: p.status,
        mode: p.mode,
        created_at: p.created_at,
        updated_at: p.updated_at,
        agent_summary: {
          total: p.agents.length,
          roles,
        },
        task_summary: taskSummary,
        latest_session: latestSession
          ? {
              id: latestSession.id,
              status: latestSession.status,
              token_usage: latestSession.token_usage,
              token_limit: latestSession.token_limit,
              progress_percent:
                latestSession.token_limit > 0
                  ? Math.round((latestSession.token_usage / latestSession.token_limit) * 100)
                  : 0,
            }
          : null,
      };
    });

    return NextResponse.json(successResponse(result));
  } catch (err) {
    const { body, status } = handleError(err);
    return NextResponse.json(body, { status });
  }
}

const VALID_MODES = new Set(["auto_edit", "review", "plan_only"]);
const VALID_AGENT_ROLES = new Set(["pm", "engineer", "reviewer"]);

interface TaskInput {
  title: string;
  description?: string;
  agent_role?: string;
  order: number;
  estimated_complexity?: string;
  acceptance_criteria?: string;
}

interface AgentInput {
  role: string;
  label?: string;
  instruction?: string;
  model?: string;
  allowedTools?: string[];
  chainOrder?: number;
  maxTurns?: number;
}

// POST /api/pipelines - Create a new pipeline with optional tasks and agents
export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthenticatedUser();

    const body = await request.json();

    // Validate required fields
    if (!body.title || typeof body.title !== "string" || body.title.trim().length === 0) {
      throw Errors.badRequest("title is required");
    }

    if (body.mode && !VALID_MODES.has(body.mode)) {
      throw Errors.badRequest(`Invalid mode: ${body.mode}. Must be one of: auto_edit, review, plan_only`);
    }

    // Validate tasks array if provided
    const tasksInput: TaskInput[] = body.tasks ?? [];
    if (body.tasks && !Array.isArray(body.tasks)) {
      throw Errors.badRequest("tasks must be an array");
    }
    for (const t of tasksInput) {
      if (!t.title || typeof t.title !== "string") {
        throw Errors.badRequest("Each task must have a title");
      }
    }

    // Validate agents array if provided
    const agentsInput: AgentInput[] = body.agents ?? [];
    if (body.agents && !Array.isArray(body.agents)) {
      throw Errors.badRequest("agents must be an array");
    }
    for (const a of agentsInput) {
      if (!a.role || !VALID_AGENT_ROLES.has(a.role)) {
        throw Errors.badRequest(`Invalid agent role: ${a.role}. Must be one of: pm, engineer, reviewer`);
      }
    }

    // 1. Insert pipeline
    const { data: pipeline, error: pipelineError } = await supabase
      .from("pipelines")
      .insert({
        title: body.title.trim(),
        description: body.description ?? null,
        original_query: body.original_query ?? null,
        mode: body.mode ?? "auto_edit",
        config: body.config ?? {},
        preset_template_id: body.preset_template_id ?? null,
        user_id: user.id,
      })
      .select("id, title, description, original_query, status, mode, config, preset_template_id, created_at, updated_at")
      .single();

    if (pipelineError || !pipeline) {
      throw Errors.internal(pipelineError?.message ?? "Failed to create pipeline");
    }

    const pipelineId = pipeline.id;
    let insertedTasks: unknown[] = [];
    let insertedAgents: unknown[] = [];

    try {
      // 2. Bulk insert tasks
      if (tasksInput.length > 0) {
        const taskRows = tasksInput.map((t, i) => ({
          pipeline_id: pipelineId,
          title: t.title,
          description: t.description ?? null,
          order_index: t.order ?? i + 1,
          type: "general" as const,
          status: "pending" as const,
          input_data: {
            ...(t.agent_role ? { agent_role: t.agent_role } : {}),
            ...(t.estimated_complexity ? { estimated_complexity: t.estimated_complexity } : {}),
            ...(t.acceptance_criteria ? { acceptance_criteria: t.acceptance_criteria } : {}),
          },
        }));

        const { data: tasks, error: tasksError } = await supabase
          .from("tasks")
          .insert(taskRows)
          .select("id, title, description, type, status, order_index");

        if (tasksError) {
          throw new Error(tasksError.message);
        }

        insertedTasks = tasks ?? [];
      }

      // 3. Bulk insert agents
      if (agentsInput.length > 0) {
        const agentRows = agentsInput.map((a) => ({
          pipeline_id: pipelineId,
          role: a.role,
          instruction: a.instruction ?? null,
          model: a.model ?? "claude-opus-4-6",
          config: {
            ...(a.label ? { label: a.label } : {}),
            ...(a.allowedTools?.length ? { allowedTools: a.allowedTools } : {}),
            ...(a.maxTurns ? { maxTurns: a.maxTurns } : {}),
            chainOrder: a.chainOrder ?? ({ pm: 1, engineer: 2, reviewer: 3 }[a.role] ?? 2),
          },
        }));

        const { data: agents, error: agentsError } = await supabase
          .from("agents")
          .insert(agentRows)
          .select("id, role, instruction, model, config");

        if (agentsError) {
          throw new Error(agentsError.message);
        }

        insertedAgents = agents ?? [];
      }
    } catch (bulkError) {
      // Cleanup: delete the pipeline (cascades to tasks and agents via FK)
      await supabase.from("pipelines").delete().eq("id", pipelineId);
      throw Errors.internal(
        `Failed to create pipeline resources: ${bulkError instanceof Error ? bulkError.message : "Unknown error"}`
      );
    }

    return NextResponse.json(
      successResponse({
        ...pipeline,
        tasks: insertedTasks,
        agents: insertedAgents,
      }),
      { status: 201 }
    );
  } catch (err) {
    const { body, status } = handleError(err);
    return NextResponse.json(body, { status });
  }
}
