import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { successResponse, errorResponse } from "@/lib/api/response";

type Params = { params: Promise<{ id: string }> };

// GET /api/pipelines/[id] - Get pipeline details
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

  // Fetch pipeline with tasks, agents, and latest session
  const { data, error: dbError } = await supabase
    .from("pipelines")
    .select("*, tasks(*), agents(*), sessions(id, status, token_usage, token_limit, started_at, completed_at, metadata)")
    .eq("id", id)
    .eq("user_id", user.id)
    .order("created_at", { foreignTable: "sessions", ascending: false })
    .single();

  if (dbError || !data) {
    return NextResponse.json(errorResponse("Pipeline not found", "NOT_FOUND", 404), { status: 404 });
  }

  return NextResponse.json(successResponse(data));
}

// PATCH /api/pipelines/[id] - Update pipeline
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
  const body = await request.json();

  // TODO: Add input validation in subsequent sprint
  const { data, error: dbError } = await supabase
    .from("pipelines")
    .update(body)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (dbError || !data) {
    return NextResponse.json(errorResponse("Pipeline not found", "NOT_FOUND", 404), { status: 404 });
  }

  return NextResponse.json(successResponse(data));
}

// DELETE /api/pipelines/[id] - Delete pipeline
export async function DELETE(_request: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(errorResponse("Unauthorized", "UNAUTHORIZED", 401), { status: 401 });
  }

  const { id } = await params;

  const { error: dbError } = await supabase
    .from("pipelines")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (dbError) {
    return NextResponse.json(errorResponse(dbError.message, "INTERNAL_ERROR", 500), { status: 500 });
  }

  return NextResponse.json(successResponse(null));
}
