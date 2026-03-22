import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { successResponse, handleError } from "@/lib/api/response";
import { Errors } from "@/lib/api/errors";

type Params = { params: Promise<{ id: string }> };

// GET /api/sessions/[id] - Get session details
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    const { id } = await params;

    // TODO: Add related data joins in subsequent sprint
    const { data, error: dbError } = await supabase
      .from("sessions")
      .select("*, pipelines!inner(user_id)")
      .eq("id", id)
      .eq("pipelines.user_id", user.id)
      .single();

    if (dbError || !data) {
      throw Errors.notFound("Session");
    }

    return NextResponse.json(successResponse(data));
  } catch (err) {
    const { body, status } = handleError(err);
    return NextResponse.json(body, { status });
  }
}
