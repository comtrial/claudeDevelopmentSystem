import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { successResponse, errorResponse } from "@/lib/api/response";

// POST /api/pipelines/clone - Clone an existing pipeline
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(errorResponse("Unauthorized", "UNAUTHORIZED", 401), { status: 401 });
  }

  const { pipeline_id } = await request.json();

  if (!pipeline_id) {
    return NextResponse.json(errorResponse("pipeline_id is required", "BAD_REQUEST", 400), { status: 400 });
  }

  // TODO: Implement deep clone with tasks and agents in subsequent sprint
  return NextResponse.json(successResponse(null));
}
