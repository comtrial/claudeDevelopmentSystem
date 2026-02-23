import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { successResponse, handleError } from "@/lib/api/response";
import { Errors } from "@/lib/api/errors";

// Dev-only simulation endpoint
if (process.env.NODE_ENV === "production") {
  // This module should never be reached in production
  console.error("[dev/simulate] This route must not be used in production!");
}

// POST /api/dev/simulate - Start simulation for a pipeline
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const { supabase, user } = await getAuthenticatedUser();
    const body = await request.json();
    const { pipelineId, sessionId, speed, errorRate } = body;

    if (!pipelineId || !sessionId) {
      throw Errors.badRequest("pipelineId and sessionId are required");
    }

    // Verify ownership
    const { data: pipeline, error: fetchErr } = await supabase
      .from("pipelines")
      .select("id, status")
      .eq("id", pipelineId)
      .eq("user_id", user.id)
      .single();

    if (fetchErr || !pipeline) {
      throw Errors.notFound("Pipeline");
    }

    // Fire-and-forget
    import("@/lib/simulator/agent-simulator").then(({ runSimulator }) => {
      runSimulator(pipelineId, sessionId, { speed, errorRate }).catch((err) => {
        console.error("[dev/simulate] Simulator error:", err);
      });
    }).catch((err) => {
      console.error("[dev/simulate] Import error:", err);
    });

    return NextResponse.json(
      successResponse({ message: "Simulation started", pipelineId, sessionId })
    );
  } catch (err) {
    const { body, status } = handleError(err);
    return NextResponse.json(body, { status });
  }
}

// DELETE /api/dev/simulate - Stop simulation for a pipeline
export async function DELETE(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await getAuthenticatedUser();
    const { searchParams } = new URL(request.url);
    const pipelineId = searchParams.get("pipelineId");

    if (!pipelineId) {
      throw Errors.badRequest("pipelineId query param is required");
    }

    const { stopSimulation } = await import("@/lib/simulator/agent-simulator");
    stopSimulation(pipelineId);

    return NextResponse.json(
      successResponse({ message: "Simulation stop requested", pipelineId })
    );
  } catch (err) {
    const { body, status } = handleError(err);
    return NextResponse.json(body, { status });
  }
}
