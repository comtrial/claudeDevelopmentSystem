import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { successResponse, handleError } from "@/lib/api/response";
import { Errors } from "@/lib/api/errors";
import { handleReviewResult } from "@/lib/review/handle-review-result";

type Params = { params: Promise<{ id: string; changeId: string }> };

// PATCH /api/pipelines/[id]/changes/[changeId]/review
// Body: { action: 'approve' | 'request_changes' | 'reject', comment?: string }
export async function PATCH(request: NextRequest, { params }: Params) {
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

    const body = await request.json();
    const { action, comment } = body as { action: string; comment?: string };

    if (!action || !["approve", "request_changes", "reject"].includes(action)) {
      throw Errors.badRequest("action must be one of: approve, request_changes, reject");
    }

    const reviewStatusMap: Record<string, string> = {
      approve: "approved",
      request_changes: "changes_requested",
      reject: "rejected",
    };

    const newStatus = reviewStatusMap[action];

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

    // Update review status
    const { data, error: dbErr } = await supabase
      .from("code_changes")
      .update({ review_status: newStatus })
      .eq("id", changeId)
      .eq("session_id", session.id)
      .select()
      .single();

    if (dbErr || !data) {
      throw Errors.notFound("Code change");
    }

    // If comment provided, store it in reviewer_comments field
    if (comment) {
      const existing = (data.reviewer_comments as unknown[]) ?? [];
      const newComment = {
        agent_role: "user",
        comment,
        created_at: new Date().toISOString(),
      };
      await supabase
        .from("code_changes")
        .update({ reviewer_comments: [...existing, newComment] })
        .eq("id", changeId);
    }

    // Update pipeline status based on all changes review state
    await handleReviewResult(supabase, id);

    return NextResponse.json(successResponse(data));
  } catch (err) {
    const { body, status } = handleError(err);
    return NextResponse.json(body, { status });
  }
}
