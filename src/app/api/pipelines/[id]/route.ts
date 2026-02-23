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

  // TODO: Add related data (tasks, agents) joins in subsequent sprint
  const { data, error: dbError } = await supabase
    .from("pipelines")
    .select("*, tasks(*), agents(*)")
    .eq("id", id)
    .eq("user_id", user.id)
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
