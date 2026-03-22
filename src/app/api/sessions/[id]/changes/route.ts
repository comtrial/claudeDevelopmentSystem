import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { successResponse, errorResponse } from "@/lib/api/response";

type Params = { params: Promise<{ id: string }> };

// GET /api/sessions/[id]/changes - Get code changes for a session
export async function GET(_request: NextRequest, { params }: Params) {
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

  // TODO: Add grouping by file in subsequent sprint
  const { data, error: dbError } = await supabase
    .from("code_changes")
    .select("*")
    .eq("session_id", id)
    .order("created_at", { ascending: true });

  if (dbError) {
    return NextResponse.json(errorResponse(dbError.message, "INTERNAL_ERROR", 500), { status: 500 });
  }

  return NextResponse.json(successResponse(data));
}

// PATCH /api/sessions/[id]/changes - Update review status for code changes
export async function PATCH(request: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(errorResponse("Unauthorized", "UNAUTHORIZED", 401), { status: 401 });
  }

  const { id } = await params;
  const { change_id, review_status } = await request.json();

  if (!change_id || !review_status) {
    return NextResponse.json(errorResponse("change_id and review_status are required", "BAD_REQUEST", 400), { status: 400 });
  }

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

  // TODO: Add reviewer comment append logic in subsequent sprint
  const { data, error: dbError } = await supabase
    .from("code_changes")
    .update({ review_status })
    .eq("id", change_id)
    .eq("session_id", id)
    .select()
    .single();

  if (dbError || !data) {
    return NextResponse.json(errorResponse("Code change not found", "NOT_FOUND", 404), { status: 404 });
  }

  return NextResponse.json(successResponse(data));
}
