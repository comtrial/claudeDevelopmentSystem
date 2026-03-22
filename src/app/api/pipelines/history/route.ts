import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { successResponse, handleError } from "@/lib/api/response";
import { Errors } from "@/lib/api/errors";

const HISTORY_STATUSES = ["completed", "failed", "cancelled"] as const;
const VALID_STATUS_FILTERS = new Set(["all", ...HISTORY_STATUSES]);
const VALID_SORTS = new Set(["newest", "oldest", "most_tokens"]);
const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 10;

// GET /api/pipelines/history - List completed/failed/cancelled pipelines
export async function GET(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthenticatedUser();

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status") ?? "all";
    const search = searchParams.get("search");
    const sort = searchParams.get("sort") ?? "newest";
    const page = Math.max(parseInt(searchParams.get("page") ?? "1", 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, 1),
      MAX_LIMIT
    );
    const offset = (page - 1) * limit;

    if (!VALID_STATUS_FILTERS.has(statusFilter)) {
      throw Errors.badRequest(`Invalid status filter: ${statusFilter}`);
    }
    if (!VALID_SORTS.has(sort)) {
      throw Errors.badRequest(`Invalid sort: ${sort}`);
    }

    // Build base query for count
    let countQuery = supabase
      .from("pipelines")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .in("status", statusFilter === "all" ? [...HISTORY_STATUSES] : [statusFilter]);

    if (search && search.trim().length > 0) {
      const sanitized = search.trim().replace(/%/g, "\\%");
      countQuery = countQuery.ilike("title", `%${sanitized}%`);
    }

    const { count, error: countError } = await countQuery;
    if (countError) throw Errors.internal(countError.message);

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    // Build data query
    let dataQuery = supabase
      .from("pipelines")
      .select(
        "id, title, description, status, mode, config, created_at, updated_at, started_at, completed_at, agents(id, role), sessions(id, token_usage, token_limit, started_at, completed_at)"
      )
      .eq("user_id", user.id)
      .in("status", statusFilter === "all" ? [...HISTORY_STATUSES] : [statusFilter]);

    if (search && search.trim().length > 0) {
      const sanitized = search.trim().replace(/%/g, "\\%");
      dataQuery = dataQuery.ilike("title", `%${sanitized}%`);
    }

    // Apply sort
    if (sort === "newest") {
      dataQuery = dataQuery.order("completed_at", { ascending: false, nullsFirst: false });
    } else if (sort === "oldest") {
      dataQuery = dataQuery.order("completed_at", { ascending: true, nullsFirst: true });
    } else if (sort === "most_tokens") {
      // Sort after fetching since token_usage is in sessions
      dataQuery = dataQuery.order("completed_at", { ascending: false, nullsFirst: false });
    }

    dataQuery = dataQuery.range(offset, offset + limit - 1);

    const { data: rows, error: dbError } = await dataQuery;
    if (dbError) throw Errors.internal(dbError.message);

    interface PipelineRow {
      id: string;
      title: string;
      description: string | null;
      status: string;
      mode: string;
      config: Record<string, unknown>;
      created_at: string;
      updated_at: string;
      started_at: string | null;
      completed_at: string | null;
      agents: { id: string; role: string }[];
      sessions: { id: string; token_usage: number; token_limit: number; started_at: string | null; completed_at: string | null }[];
    }

    const pipelines = ((rows ?? []) as PipelineRow[]).map((p) => {
      const totalTokens = p.sessions.reduce((sum, s) => sum + (s.token_usage ?? 0), 0);
      // Compute duration from latest session
      const latestSession = p.sessions[0] ?? null;
      const durationSec =
        latestSession?.started_at && latestSession?.completed_at
          ? Math.round(
              (new Date(latestSession.completed_at).getTime() -
                new Date(latestSession.started_at).getTime()) /
                1000
            )
          : null;

      return {
        id: p.id,
        title: p.title,
        description: p.description,
        status: p.status,
        mode: p.mode,
        created_at: p.created_at,
        updated_at: p.updated_at,
        started_at: p.started_at,
        completed_at: p.completed_at,
        agent_count: p.agents.length,
        agent_roles: [...new Set(p.agents.map((a) => a.role))],
        total_tokens: totalTokens,
        duration_sec: durationSec,
        session_count: p.sessions.length,
      };
    });

    // Sort by most_tokens after mapping
    if (sort === "most_tokens") {
      pipelines.sort((a, b) => b.total_tokens - a.total_tokens);
    }

    return NextResponse.json(
      successResponse({ pipelines, total, page, totalPages })
    );
  } catch (err) {
    const { body, status } = handleError(err);
    return NextResponse.json(body, { status });
  }
}
