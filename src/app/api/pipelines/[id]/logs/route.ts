import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { successResponse, handleError } from "@/lib/api/response";
import { Errors } from "@/lib/api/errors";

type Params = { params: Promise<{ id: string }> };

// GET /api/pipelines/[id]/logs
// Query params: cursor, limit (default 50, max 200), agent_id, level
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    const { id } = await params;

    // Verify pipeline ownership
    const { data: pipeline, error: fetchErr } = await supabase
      .from("pipelines")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchErr || !pipeline) {
      throw Errors.notFound("Pipeline");
    }

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor");
    const rawLimit = parseInt(searchParams.get("limit") ?? "50");
    const limit = Math.min(Math.max(rawLimit, 1), 200);
    const agentId = searchParams.get("agent_id");
    const level = searchParams.get("level");

    // Get the latest session for this pipeline to fetch logs
    const { data: session } = await supabase
      .from("sessions")
      .select("id")
      .eq("pipeline_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!session) {
      return NextResponse.json(successResponse({ logs: [], nextCursor: null }));
    }

    let query = supabase
      .from("agent_logs")
      .select("id, session_id, agent_role, level, message, metadata, created_at")
      .eq("session_id", session.id)
      .order("created_at", { ascending: true })
      .limit(limit + 1); // fetch one extra to determine if there are more

    if (cursor) {
      // cursor is the last log id — use it for keyset pagination via created_at
      const { data: cursorLog } = await supabase
        .from("agent_logs")
        .select("created_at")
        .eq("id", cursor)
        .single();
      if (cursorLog) {
        query = query.gt("created_at", cursorLog.created_at);
      }
    }

    if (agentId) {
      query = query.eq("agent_role", agentId);
    }

    if (level) {
      query = query.eq("level", level);
    }

    const { data: logs, error: dbErr } = await query;

    if (dbErr) {
      throw Errors.internal(dbErr.message);
    }

    const rows = logs ?? [];
    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? String(pageRows[pageRows.length - 1].id) : null;

    return NextResponse.json(successResponse({ logs: pageRows, nextCursor }));
  } catch (err) {
    const { body, status } = handleError(err);
    return NextResponse.json(body, { status });
  }
}
