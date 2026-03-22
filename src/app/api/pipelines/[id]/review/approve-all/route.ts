import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { successResponse, handleError } from "@/lib/api/response";
import { Errors } from "@/lib/api/errors";
import { handleReviewResult } from "@/lib/review/handle-review-result";

type Params = { params: Promise<{ id: string }> };

// POST /api/pipelines/[id]/review/approve-all - Bulk approve all pending changes
export async function POST(_request: NextRequest, { params }: Params) {
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

    // Bulk approve all pending changes
    const { data, error: dbErr } = await supabase
      .from("code_changes")
      .update({ review_status: "approved" })
      .eq("session_id", session.id)
      .eq("review_status", "pending")
      .select("id");

    if (dbErr) {
      throw Errors.internal(dbErr.message);
    }

    // Update pipeline status
    await handleReviewResult(supabase, id);

    return NextResponse.json(successResponse({ approved_count: (data ?? []).length }));
  } catch (err) {
    const { body, status } = handleError(err);
    return NextResponse.json(body, { status });
  }
}
