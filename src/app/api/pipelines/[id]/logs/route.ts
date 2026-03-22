import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { successResponse, handleError } from "@/lib/api/response";
import { Errors } from "@/lib/api/errors";

type Params = { params: Promise<{ id: string }> };

// Service role client for reading logs (bypasses RLS JOIN complexity)
function getServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// GET /api/pipelines/[id]/logs
// Query params: cursor, limit (default 50, max 200), agent_id, level
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    const { id } = await params;

    // Verify pipeline ownership (uses user's auth)
    const { data: pipeline, error: fetchErr } = await supabase
      .from("pipelines")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchErr || !pipeline) {
      throw Errors.notFound("Pipeline");
    }

    // Use service role for log queries (avoids RLS JOIN issues with agent_logs)
    const admin = getServiceClient();

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor");
    const rawLimit = parseInt(searchParams.get("limit") ?? "50");
    const limit = Math.min(Math.max(rawLimit, 1), 200);
    const agentId = searchParams.get("agent_id");
    const level = searchParams.get("level");
    const sessionIdParam = searchParams.get("session_id");

    // Use specified session or fall back to latest session
    let sessionId: string;
    if (sessionIdParam) {
      // Verify the session belongs to this pipeline
      const { data: targetSession } = await admin
        .from("sessions")
        .select("id")
        .eq("id", sessionIdParam)
        .eq("pipeline_id", id)
        .single();

      if (!targetSession) {
        return NextResponse.json(successResponse({ logs: [], nextCursor: null }));
      }
      sessionId = targetSession.id;
    } else {
      // Get the latest session for this pipeline
      const { data: session } = await admin
        .from("sessions")
        .select("id")
        .eq("pipeline_id", id)
        .order("started_at", { ascending: false })
        .limit(1)
        .single();

      if (!session) {
        return NextResponse.json(successResponse({ logs: [], nextCursor: null }));
      }
      sessionId = session.id;
    }

    let query = admin
      .from("agent_logs")
      .select("id, session_id, agent_role, level, message, metadata, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .limit(limit + 1);

    if (cursor) {
      const { data: cursorLog } = await admin
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
