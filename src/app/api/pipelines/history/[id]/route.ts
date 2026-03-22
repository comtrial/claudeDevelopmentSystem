import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { successResponse, handleError } from "@/lib/api/response";
import { Errors } from "@/lib/api/errors";

type Params = { params: Promise<{ id: string }> };

// GET /api/pipelines/history/[id] - Get completed pipeline detail with agents, sessions, code_changes
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    const { id } = await params;

    const { data, error: dbError } = await supabase
      .from("pipelines")
      .select(
        "*, agents(*), sessions(*, agent_logs(id, agent_role, level, message, created_at))"
      )
      .eq("id", id)
      .eq("user_id", user.id)
      .in("status", ["completed", "failed", "cancelled"])
      .single();

    if (dbError || !data) {
      throw Errors.notFound("Pipeline");
    }

    // Fetch code_changes via the latest session
    const sessions = (data.sessions ?? []) as { id: string }[];
    let code_changes: unknown[] = [];
    if (sessions.length > 0) {
      const sessionIds = sessions.map((s) => s.id);
      const { data: changes } = await supabase
        .from("code_changes")
        .select("id, session_id, file_path, change_type, additions, deletions, review_status, created_at")
        .in("session_id", sessionIds);
      code_changes = changes ?? [];
    }

    return NextResponse.json(successResponse({ ...data, code_changes }));
  } catch (err) {
    const { body, status } = handleError(err);
    return NextResponse.json(body, { status });
  }
}
