import type { SupabaseClient } from "@supabase/supabase-js";

export async function handleReviewResult(supabase: SupabaseClient, pipelineId: string) {
  // Get latest session for this pipeline
  const { data: session } = await supabase
    .from("sessions")
    .select("id")
    .eq("pipeline_id", pipelineId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!session) return;

  const { data: changes } = await supabase
    .from("code_changes")
    .select("review_status")
    .eq("session_id", session.id);

  const statuses = changes?.map((c: { review_status: string }) => c.review_status) ?? [];

  if (statuses.length === 0) return;

  if (statuses.every((s: string) => s === "approved")) {
    await supabase
      .from("pipelines")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", pipelineId);
  } else if (statuses.some((s: string) => s === "rejected")) {
    await supabase
      .from("pipelines")
      .update({ status: "failed" })
      .eq("id", pipelineId);
  }
}
