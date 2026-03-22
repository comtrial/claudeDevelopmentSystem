import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { successResponse, errorResponse } from "@/lib/api/response";

type Params = { params: Promise<{ id: string }> };

// GET /api/pipelines/[id]/sessions - List sessions for a pipeline
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

  // Verify pipeline ownership
  const { data: pipeline } = await supabase
    .from("pipelines")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!pipeline) {
    return NextResponse.json(errorResponse("Pipeline not found", "NOT_FOUND", 404), { status: 404 });
  }

  // TODO: Add pagination in subsequent sprint
  const { data, error: dbError } = await supabase
    .from("sessions")
    .select("*")
    .eq("pipeline_id", id)
    .order("started_at", { ascending: false });

  if (dbError) {
    return NextResponse.json(errorResponse(dbError.message, "INTERNAL_ERROR", 500), { status: 500 });
  }

  return NextResponse.json(successResponse(data));
}
