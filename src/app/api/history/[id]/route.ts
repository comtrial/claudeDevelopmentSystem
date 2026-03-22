import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { successResponse, handleError } from "@/lib/api/response";
import { Errors } from "@/lib/api/errors";

type Params = { params: Promise<{ id: string }> };

// GET /api/history/[id] - Get pipeline history detail
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    const { id } = await params;

    const { data, error: dbError } = await supabase
      .from("pipeline_history")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (dbError || !data) {
      throw Errors.notFound("Pipeline history");
    }

    return NextResponse.json(successResponse(data));
  } catch (err) {
    const { body, status } = handleError(err);
    return NextResponse.json(body, { status });
  }
}
