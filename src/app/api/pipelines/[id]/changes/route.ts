import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { successResponse, handleError } from "@/lib/api/response";
import { Errors } from "@/lib/api/errors";

type Params = { params: Promise<{ id: string }> };

// GET /api/pipelines/[id]/changes - List code changes for a pipeline
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    const { id } = await params;

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

    // Get latest session for this pipeline
    const { data: session } = await supabase
      .from("sessions")
      .select("id")
      .eq("pipeline_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!session) {
      return NextResponse.json(successResponse([]));
    }

    const { data, error: dbErr } = await supabase
      .from("code_changes")
      .select("id, session_id, file_path, change_type, additions, deletions, review_status, created_at")
      .eq("session_id", session.id)
      .order("file_path", { ascending: true });

    if (dbErr) {
      throw Errors.internal(dbErr.message);
    }

    return NextResponse.json(successResponse(data ?? []));
  } catch (err) {
    const { body, status } = handleError(err);
    return NextResponse.json(body, { status });
  }
}
