import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { successResponse, errorResponse } from "@/lib/api/response";

// GET /api/history - List pipeline history with search/filter
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(errorResponse("Unauthorized", "UNAUTHORIZED", 401), { status: 401 });
  }

  // TODO: Add cursor-based pagination in subsequent sprint
  const { searchParams } = new URL(request.url);

  let query = supabase
    .from("pipeline_history")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const search = searchParams.get("search");
  if (search) {
    query = query.or(`title.ilike.%${search}%,summary.ilike.%${search}%`);
  }

  const status = searchParams.get("status");
  if (status) query = query.eq("status", status);

  const limit = parseInt(searchParams.get("limit") ?? "20");
  const offset = parseInt(searchParams.get("offset") ?? "0");
  query = query.range(offset, offset + limit - 1);

  const { data, error: dbError } = await query;

  if (dbError) {
    return NextResponse.json(errorResponse(dbError.message, "INTERNAL_ERROR", 500), { status: 500 });
  }

  return NextResponse.json(successResponse(data));
}
