import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { successResponse, errorResponse } from "@/lib/api/response";

type Params = { params: Promise<{ id: string }> };

// GET /api/sessions/[id]/logs - Get session logs with filtering
export async function GET(request: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(errorResponse("Unauthorized", "UNAUTHORIZED", 401), { status: 401 });
  }

  const { id } = await params;

  // Verify session ownership via pipeline
  const { data: session } = await supabase
    .from("sessions")
    .select("id, pipelines!inner(user_id)")
    .eq("id", id)
    .eq("pipelines.user_id", user.id)
    .single();

  if (!session) {
    return NextResponse.json(errorResponse("Session not found", "NOT_FOUND", 404), { status: 404 });
  }

  // TODO: Add cursor-based pagination in subsequent sprint
  const { searchParams } = new URL(request.url);
  let query = supabase
    .from("agent_logs")
    .select("*")
    .eq("session_id", id)
    .order("created_at", { ascending: true });

  const level = searchParams.get("level");
  if (level) query = query.eq("level", level);

  const agentRole = searchParams.get("agent_role");
  if (agentRole) query = query.eq("agent_role", agentRole);

  const limit = parseInt(searchParams.get("limit") ?? "100");
  query = query.limit(limit);

  const { data, error: dbError } = await query;

  if (dbError) {
    return NextResponse.json(errorResponse(dbError.message, "INTERNAL_ERROR", 500), { status: 500 });
  }

  return NextResponse.json(successResponse(data));
}
