import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { successResponse, handleError } from "@/lib/api/response";
import { Errors } from "@/lib/api/errors";

type Params = { params: Promise<{ id: string }> };

// POST /api/pipelines/[id]/pause
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

    if (pipeline.status !== "running") {
      throw Errors.conflict(`Cannot pause pipeline with status '${pipeline.status}'. Only 'running' pipelines can be paused.`);
    }

    const { data, error: updateErr } = await supabase
      .from("pipelines")
      .update({ status: "paused" })
      .eq("id", id)
      .select("id, status")
      .single();

    if (updateErr || !data) {
      throw Errors.internal(updateErr?.message ?? "Failed to pause pipeline");
    }

    // Also pause the active session
    await supabase
      .from("sessions")
      .update({ status: "paused" })
      .eq("pipeline_id", id)
      .eq("status", "running");

    return NextResponse.json(successResponse(data));
  } catch (err) {
    const { body, status } = handleError(err);
    return NextResponse.json(body, { status });
  }
}
