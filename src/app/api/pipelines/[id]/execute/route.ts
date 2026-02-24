import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { successResponse, handleError } from "@/lib/api/response";
import { Errors } from "@/lib/api/errors";
import type { FollowUpContext } from "@/lib/simulator/agent-simulator";

type Params = { params: Promise<{ id: string }> };

const MAX_SESSIONS_PER_PIPELINE = 10;

function getServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// POST /api/pipelines/[id]/execute - Execute a pipeline (initial or follow-up)
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    const { id } = await params;

    // Parse optional follow_up_prompt from request body
    let followUpPrompt: string | undefined;
    try {
      const body = await request.json();
      followUpPrompt = body.follow_up_prompt;
    } catch {
      // No body or invalid JSON — initial execution
    }

    const isFollowUp = !!followUpPrompt;

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

    // Block running pipelines
    if (pipeline.status === "running") {
      throw Errors.conflict("Pipeline is already running");
    }

    // Status validation: follow-up allows completed/failed, initial allows draft/failed
    if (isFollowUp) {
      const followUpStatuses = ["completed", "failed"];
      if (!followUpStatuses.includes(pipeline.status)) {
        throw Errors.badRequest(
          `Follow-up query requires 'completed' or 'failed' status. Current: '${pipeline.status}'`
        );
      }
    } else {
      const executableStatuses = ["draft", "failed"];
      if (!executableStatuses.includes(pipeline.status)) {
        throw Errors.badRequest(
          `Pipeline cannot be executed from '${pipeline.status}' status. Only 'draft' or 'failed' pipelines can be executed.`
        );
      }
    }

    // For follow-up: check session count limit and find parent session
    const admin = getServiceClient();
    let parentSessionId: string | null = null;
    let sessionNumber = 1;

    if (isFollowUp) {
      const { data: existingSessions, error: sessErr } = await admin
        .from("sessions")
        .select("id, session_number")
        .eq("pipeline_id", id)
        .order("session_number", { ascending: false });

      if (sessErr) {
        throw Errors.internal(sessErr.message);
      }

      if (existingSessions && existingSessions.length >= MAX_SESSIONS_PER_PIPELINE) {
        throw Errors.badRequest(
          `세션 수 상한(${MAX_SESSIONS_PER_PIPELINE}개)에 도달했습니다. 새 파이프라인을 생성해 주세요.`
        );
      }

      if (existingSessions && existingSessions.length > 0) {
        parentSessionId = existingSessions[0].id;
        sessionNumber = existingSessions[0].session_number + 1;
      }

      // Reset tasks to pending for re-execution
      await admin
        .from("tasks")
        .update({ status: "pending" })
        .eq("pipeline_id", id);

      // Reset agents to idle (output_artifact in config JSONB is preserved for follow-up context)
      await admin
        .from("agents")
        .update({ status: "idle", current_task: null, progress: 0 })
        .eq("pipeline_id", id);
    }

    // Update pipeline status to running
    const { error: updateErr } = await supabase
      .from("pipelines")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", id);

    if (updateErr) {
      throw Errors.internal(updateErr.message);
    }

    // Create a new session with follow-up fields
    const { data: session, error: sessionErr } = await supabase
      .from("sessions")
      .insert({
        pipeline_id: id,
        status: "running",
        token_usage: 0,
        token_limit: 100000,
        metadata: {},
        follow_up_prompt: followUpPrompt ?? null,
        parent_session_id: parentSessionId,
        session_number: sessionNumber,
      })
      .select("id, pipeline_id, status, token_usage, token_limit, started_at, session_number")
      .single();

    if (sessionErr || !session) {
      // Rollback pipeline status
      const rollbackStatus = isFollowUp ? "completed" : "draft";
      await supabase
        .from("pipelines")
        .update({ status: rollbackStatus, started_at: null })
        .eq("id", id);

      throw Errors.internal(sessionErr?.message ?? "Failed to create session");
    }

    // Build follow-up context for simulator
    const followUpContext: FollowUpContext | undefined = isFollowUp && parentSessionId
      ? { followUpPrompt: followUpPrompt!, parentSessionId }
      : undefined;

    // Fire-and-forget: trigger agent simulator
    triggerSimulator(id, session.id, followUpContext).catch((err) => {
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

async function triggerSimulator(
  pipelineId: string,
  sessionId: string,
  followUpContext?: FollowUpContext
): Promise<void> {
  try {
    const { runSimulator } = await import("@/lib/simulator/agent-simulator");
    await runSimulator(pipelineId, sessionId, {}, followUpContext);
  } catch (err) {
    console.warn(`[execute] Simulator failed for pipeline ${pipelineId}:`, err);
  }
}
