import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { successResponse, handleError } from "@/lib/api/response";
import { Errors } from "@/lib/api/errors";

const HISTORY_COLUMNS = "id, pipeline_id, user_id, title, summary, status, total_tokens, total_duration_sec, task_count, file_changes_count, config_snapshot, created_at";
const VALID_STATUSES = new Set<string>(["completed", "failed", "all"]);
const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 10;

// GET /api/history - List pipeline history with search/filter
export async function GET(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthenticatedUser();

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status") ?? "all";
    const search = searchParams.get("search");
    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, 1),
      MAX_LIMIT
    );
    const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10) || 0, 0);

    if (!VALID_STATUSES.has(statusFilter)) {
      throw Errors.badRequest(`Invalid status filter: ${statusFilter}`);
    }

    let query = supabase
      .from("pipeline_history")
      .select(HISTORY_COLUMNS)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    if (search && search.trim().length > 0) {
      const sanitized = search.trim().replace(/%/g, "\\%");
      query = query.ilike("title", `%${sanitized}%`);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error: dbError } = await query;

    if (dbError) {
      throw Errors.internal(dbError.message);
    }

    return NextResponse.json(successResponse(data));
  } catch (err) {
    const { body, status } = handleError(err);
    return NextResponse.json(body, { status });
  }
}
