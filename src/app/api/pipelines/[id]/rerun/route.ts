import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { successResponse, handleError } from "@/lib/api/response";
import { Errors } from "@/lib/api/errors";

type Params = { params: Promise<{ id: string }> };

// POST /api/pipelines/[id]/rerun - Clone pipeline as a new draft
export async function POST(_request: NextRequest, { params }: Params) {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    const { id } = await params;

    // Fetch original pipeline
    const { data: original, error: fetchError } = await supabase
      .from("pipelines")
      .select("title, description, mode, config, preset_template_id, agents(role, instruction, model, config), tasks(title, description, type, order_index)")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !original) {
      throw Errors.notFound("Pipeline");
    }

    // Create new draft pipeline from original config
    const { data: newPipeline, error: createError } = await supabase
      .from("pipelines")
      .insert({
        title: `${original.title} (재실행)`,
        description: original.description,
        mode: original.mode,
        config: original.config,
        preset_template_id: original.preset_template_id,
        user_id: user.id,
        status: "draft",
      })
      .select("id")
      .single();

    if (createError || !newPipeline) {
      throw Errors.internal("Failed to create pipeline");
    }

    const newId = newPipeline.id;

    // Clone agents
    const agents = (original.agents ?? []) as {
      role: string;
      instruction: string | null;
      model: string;
      config: Record<string, unknown>;
    }[];
    if (agents.length > 0) {
      await supabase.from("agents").insert(
        agents.map((a) => ({
          pipeline_id: newId,
          role: a.role,
          instruction: a.instruction,
          model: a.model,
          config: a.config,
        }))
      );
    }

    // Clone tasks
    const tasks = (original.tasks ?? []) as {
      title: string;
      description: string | null;
      type: string;
      order_index: number;
    }[];
    if (tasks.length > 0) {
      await supabase.from("tasks").insert(
        tasks.map((t) => ({
          pipeline_id: newId,
          title: t.title,
          description: t.description,
          type: t.type,
          order_index: t.order_index,
          status: "pending",
        }))
      );
    }

    return NextResponse.json(successResponse({ pipelineId: newId }));
  } catch (err) {
    const { body, status } = handleError(err);
    return NextResponse.json(body, { status });
  }
}
