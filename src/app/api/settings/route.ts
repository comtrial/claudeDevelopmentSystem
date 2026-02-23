import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { successResponse, errorResponse } from "@/lib/api/response";

// GET /api/settings - Get user settings
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(errorResponse("Unauthorized", "UNAUTHORIZED", 401), { status: 401 });
  }

  const { data, error: dbError } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (dbError || !data) {
    return NextResponse.json(errorResponse("User settings not found", "NOT_FOUND", 404), { status: 404 });
  }

  return NextResponse.json(successResponse(data));
}

// PATCH /api/settings - Update user settings
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(errorResponse("Unauthorized", "UNAUTHORIZED", 401), { status: 401 });
  }

  // TODO: Add input validation in subsequent sprint
  const body = await request.json();
  delete body.user_id;

  const { data, error: dbError } = await supabase
    .from("user_settings")
    .update(body)
    .eq("user_id", user.id)
    .select()
    .single();

  if (dbError) {
    return NextResponse.json(errorResponse(dbError.message, "INTERNAL_ERROR", 500), { status: 500 });
  }

  return NextResponse.json(successResponse(data));
}
