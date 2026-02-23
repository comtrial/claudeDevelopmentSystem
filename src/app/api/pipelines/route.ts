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
      .select("id, title, description, status, mode, created_at, updated_at, agents(id, role), sessions(id, status, token_usage, token_limit)")
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

// POST /api/pipelines - Create a new pipeline
export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthenticatedUser();

    const body = await request.json();

    const { data, error: dbError } = await supabase
      .from("pipelines")
      .insert({ ...body, user_id: user.id })
      .select("id, title, description, status, mode, config, preset_template_id, created_at, updated_at")
      .single();

    if (dbError) {
      throw Errors.internal(dbError.message);
    }

    return NextResponse.json(successResponse(data), { status: 201 });
  } catch (err) {
    const { body, status } = handleError(err);
    return NextResponse.json(body, { status });
  }
}
