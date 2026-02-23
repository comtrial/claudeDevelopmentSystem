import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { successResponse, handleError } from "@/lib/api/response";
import { Errors } from "@/lib/api/errors";

type Params = { params: Promise<{ id: string }> };

// POST /api/pipelines/[id]/resume
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

    if (pipeline.status !== "paused") {
      throw Errors.conflict(`Cannot resume pipeline with status '${pipeline.status}'. Only 'paused' pipelines can be resumed.`);
    }

    const { data, error: updateErr } = await supabase
      .from("pipelines")
      .update({ status: "running" })
      .eq("id", id)
      .select("id, status")
      .single();

    if (updateErr || !data) {
      throw Errors.internal(updateErr?.message ?? "Failed to resume pipeline");
    }

    // Also resume the paused session
    await supabase
      .from("sessions")
      .update({ status: "running" })
      .eq("pipeline_id", id)
      .eq("status", "paused");

    return NextResponse.json(successResponse(data));
  } catch (err) {
    const { body, status } = handleError(err);
    return NextResponse.json(body, { status });
  }
}
