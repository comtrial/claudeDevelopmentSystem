import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/api/errors";

export async function handleReviewResult(supabase: SupabaseClient, pipelineId: string) {
  // Get latest session for this pipeline
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id")
    .eq("pipeline_id", pipelineId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (sessionError) {
    throw new AppError(500, `Failed to fetch session: ${sessionError.message}`, "INTERNAL_ERROR");
  }

  if (!session) return;

  const { data: changes, error: changesError } = await supabase
    .from("code_changes")
    .select("review_status")
    .eq("session_id", session.id);

  if (changesError) {
    throw new AppError(500, `Failed to fetch code changes: ${changesError.message}`, "INTERNAL_ERROR");
  }

  const statuses = changes?.map((c: { review_status: string }) => c.review_status) ?? [];

  if (statuses.length === 0) return;

  if (statuses.every((s: string) => s === "approved")) {
    const { error: updateError } = await supabase
      .from("pipelines")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", pipelineId);

    if (updateError) {
      throw new AppError(500, `Failed to update pipeline status: ${updateError.message}`, "INTERNAL_ERROR");
    }
  } else if (statuses.some((s: string) => s === "rejected")) {
    const { error: updateError } = await supabase
      .from("pipelines")
      .update({ status: "failed", completed_at: new Date().toISOString() })
      .eq("id", pipelineId);

    if (updateError) {
      throw new AppError(500, `Failed to update pipeline status: ${updateError.message}`, "INTERNAL_ERROR");
    }
  }
}
