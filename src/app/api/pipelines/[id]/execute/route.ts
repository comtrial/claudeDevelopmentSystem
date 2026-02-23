import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { successResponse, errorResponse } from "@/lib/api/response";

type Params = { params: Promise<{ id: string }> };

// POST /api/pipelines/[id]/execute - Execute a pipeline
export async function POST(_request: NextRequest, { params }: Params) {
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
  const { data: pipeline, error: fetchErr } = await supabase
    .from("pipelines")
    .select("id, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchErr || !pipeline) {
    return NextResponse.json(errorResponse("Pipeline not found", "NOT_FOUND", 404), { status: 404 });
  }

  if (pipeline.status === "running") {
    return NextResponse.json(errorResponse("Pipeline is already running", "CONFLICT", 409), { status: 409 });
  }

  // TODO: Create session and trigger agent execution in subsequent sprint
  return NextResponse.json(successResponse(null), { status: 201 });
}
