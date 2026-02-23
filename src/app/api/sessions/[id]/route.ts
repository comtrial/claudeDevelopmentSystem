import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { successResponse, errorResponse } from "@/lib/api/response";

type Params = { params: Promise<{ id: string }> };

// GET /api/sessions/[id] - Get session details
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

  // TODO: Add related data joins in subsequent sprint
  const { data, error: dbError } = await supabase
    .from("sessions")
    .select("*, pipelines!inner(user_id)")
    .eq("id", id)
    .eq("pipelines.user_id", user.id)
    .single();

  if (dbError || !data) {
    return NextResponse.json(errorResponse("Session not found", "NOT_FOUND", 404), { status: 404 });
  }

  return NextResponse.json(successResponse(data));
}
