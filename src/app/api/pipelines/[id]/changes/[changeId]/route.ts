import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { successResponse, handleError } from "@/lib/api/response";
import { Errors } from "@/lib/api/errors";

type Params = { params: Promise<{ id: string; changeId: string }> };

// GET /api/pipelines/[id]/changes/[changeId] - Get single change with diff content
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    const { id, changeId } = await params;

    // Verify pipeline ownership
    const { data: pipeline, error: pipelineErr } = await supabase
      .from("pipelines")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (pipelineErr || !pipeline) {
      throw Errors.notFound("Pipeline");
    }

    // Get latest session
    const { data: session } = await supabase
      .from("sessions")
      .select("id")
      .eq("pipeline_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!session) {
      throw Errors.notFound("Session");
    }

    const { data, error: dbErr } = await supabase
      .from("code_changes")
      .select("*")
      .eq("id", changeId)
      .eq("session_id", session.id)
      .single();

    if (dbErr || !data) {
      throw Errors.notFound("Code change");
    }

    return NextResponse.json(successResponse(data));
  } catch (err) {
    const { body, status } = handleError(err);
    return NextResponse.json(body, { status });
  }
}
