import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { successResponse, errorResponse } from "@/lib/api/response";

type Params = { params: Promise<{ id: string }> };

// GET /api/history/[id] - Get pipeline history detail
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

  const { data, error: dbError } = await supabase
    .from("pipeline_history")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (dbError || !data) {
    return NextResponse.json(errorResponse("Pipeline history not found", "NOT_FOUND", 404), { status: 404 });
  }

  return NextResponse.json(successResponse(data));
}
