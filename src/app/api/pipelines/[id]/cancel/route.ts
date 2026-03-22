import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { successResponse, handleError } from "@/lib/api/response";
import { Errors } from "@/lib/api/errors";

type Params = { params: Promise<{ id: string }> };

const CANCELLABLE_STATUSES = ["running", "paused"];

// POST /api/pipelines/[id]/cancel
export async function POST(_request: NextRequest, { params }: Params) {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    const { id } = await params;

    const { data: pipeline, error: fetchErr } = await supabase
      .from("pipelines")
      .select("id, status")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchErr || !pipeline) {
      throw Errors.notFound("Pipeline");
    }

    if (!CANCELLABLE_STATUSES.includes(pipeline.status)) {
      throw Errors.conflict(`Cannot cancel pipeline with status '${pipeline.status}'. Only 'running' or 'paused' pipelines can be cancelled.`);
    }

    const { data, error: updateErr } = await supabase
      .from("pipelines")
      .update({ status: "cancelled", completed_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, status")
      .single();

    if (updateErr || !data) {
      throw Errors.internal(updateErr?.message ?? "Failed to cancel pipeline");
    }

    // Cancel all active sessions for this pipeline
    await supabase
      .from("sessions")
      .update({ status: "cancelled", completed_at: new Date().toISOString() })
      .eq("pipeline_id", id)
      .in("status", ["running", "paused"]);

    return NextResponse.json(successResponse(data));
  } catch (err) {
    const { body, status } = handleError(err);
    return NextResponse.json(body, { status });
  }
}
