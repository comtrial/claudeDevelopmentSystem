import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { successResponse, handleError } from "@/lib/api/response";
import { Errors } from "@/lib/api/errors";

type Params = { params: Promise<{ id: string }> };

// POST /api/pipelines/[id]/execute - Execute a pipeline
export async function POST(_request: NextRequest, { params }: Params) {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    const { id } = await params;

    // Verify pipeline exists and belongs to user
    const { data: pipeline, error: fetchErr } = await supabase
      .from("pipelines")
      .select("id, status, title")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchErr || !pipeline) {
      throw Errors.notFound("Pipeline");
    }

    // Only draft pipelines can be executed
    if (pipeline.status === "running") {
      throw Errors.conflict("Pipeline is already running");
    }

    if (pipeline.status !== "draft") {
      throw Errors.badRequest(
        `Pipeline cannot be executed from '${pipeline.status}' status. Only 'draft' pipelines can be executed.`
      );
    }

    // Update pipeline status to running
    const { error: updateErr } = await supabase
      .from("pipelines")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", id);

    if (updateErr) {
      throw Errors.internal(updateErr.message);
    }

    // Create a new session
    const { data: session, error: sessionErr } = await supabase
      .from("sessions")
      .insert({
        pipeline_id: id,
        status: "running",
        token_usage: 0,
        token_limit: 100000,
        metadata: {},
      })
      .select("id, pipeline_id, status, token_usage, token_limit, started_at")
      .single();

    if (sessionErr || !session) {
      // Rollback pipeline status
      await supabase
        .from("pipelines")
        .update({ status: "draft", started_at: null })
        .eq("id", id);

      throw Errors.internal(sessionErr?.message ?? "Failed to create session");
    }

    // Fire-and-forget: trigger agent simulator (BE-2.4)
    // The simulator runs asynchronously and updates session/task status as it progresses.
    // Import is dynamic to avoid circular dependencies and allow BE-2.4 to be built independently.
    triggerSimulator(id, session.id).catch((err) => {
      console.error(`[execute] Simulator failed for pipeline ${id}:`, err);
    });

    return NextResponse.json(
      successResponse({
        pipeline_id: id,
        session: session,
      }),
      { status: 201 }
    );
  } catch (err) {
    const { body, status } = handleError(err);
    return NextResponse.json(body, { status });
  }
}

async function triggerSimulator(pipelineId: string, sessionId: string): Promise<void> {
  try {
    const { runSimulator } = await import("@/lib/pipeline/simulator");
    await runSimulator(pipelineId, sessionId);
  } catch {
    // Simulator module may not exist yet (BE-2.4). Silently ignore import errors.
    console.warn(`[execute] Simulator module not available yet for pipeline ${pipelineId}`);
  }
}
