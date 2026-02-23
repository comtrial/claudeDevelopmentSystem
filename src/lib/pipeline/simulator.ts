/**
 * Pipeline Agent Simulator (BE-2.4)
 *
 * Simulates agent execution for a pipeline session.
 * Called fire-and-forget from the execute API (BE-2.3).
 *
 * Constraints:
 * - Must complete within ~10-20 seconds (Vercel serverless timeout)
 * - No real Claude API calls — pure simulation
 * - Uses 1-second intervals between steps
 */

import { createClient } from "@/lib/supabase/server";
import { SAMPLE_LOGS, SAMPLE_DIFFS } from "./sample-data";

const STEP_DELAY_MS = 1_500;
const TOKENS_PER_STEP = 2_500;

interface TaskRow {
  id: string;
  title: string;
  order_index: number;
}

interface AgentRow {
  id: string;
  role: string;
}

export async function runSimulator(
  pipelineId: string,
  sessionId: string
): Promise<void> {
  const supabase = await createClient();

  // Fetch tasks and agents for this pipeline
  const [{ data: tasks }, { data: agents }] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, order_index")
      .eq("pipeline_id", pipelineId)
      .order("order_index", { ascending: true }),
    supabase
      .from("agents")
      .select("id, role")
      .eq("pipeline_id", pipelineId),
  ]);

  if (!tasks || tasks.length === 0 || !agents || agents.length === 0) {
    // Nothing to simulate — mark session as completed immediately
    await completeSession(supabase, pipelineId, sessionId, 0);
    return;
  }

  const agentsByRole = new Map<string, AgentRow>();
  for (const agent of agents as AgentRow[]) {
    agentsByRole.set(agent.role, agent);
  }

  // Determine agent execution order based on available roles
  const roleOrder = ["pm", "engineer", "reviewer"];
  const activeRoles = roleOrder.filter((r) => agentsByRole.has(r));

  let totalTokens = 0;
  const stepsPerTask = activeRoles.reduce(
    (sum, role) => sum + (SAMPLE_LOGS[role] ?? []).length,
    0
  );
  const totalSteps = Math.max(stepsPerTask * (tasks as TaskRow[]).length, 1);
  let currentStep = 0;

  try {
    for (const taskRow of tasks as TaskRow[]) {
      // Mark task as in_progress
      await supabase
        .from("tasks")
        .update({ status: "in_progress" })
        .eq("id", taskRow.id);

      for (const role of activeRoles) {
        const logs = SAMPLE_LOGS[role] ?? [];

        for (const log of logs) {
          currentStep++;
          totalTokens += TOKENS_PER_STEP;

          // Insert agent log
          await supabase.from("agent_logs").insert({
            session_id: sessionId,
            agent_role: role,
            level: log.level,
            message: `[${taskRow.title}] ${log.message}`,
            metadata: { task_id: taskRow.id, step: currentStep },
          });

          // Update session token usage
          await supabase
            .from("sessions")
            .update({
              token_usage: totalTokens,
              metadata: {
                progress_percent: Math.round((currentStep / totalSteps) * 100),
                current_task: taskRow.title,
                current_agent: role,
              },
            })
            .eq("id", sessionId);

          await delay(STEP_DELAY_MS);
        }
      }

      // Mark task as completed
      await supabase
        .from("tasks")
        .update({ status: "completed" })
        .eq("id", taskRow.id);
    }

    // Insert sample code changes
    for (const diff of SAMPLE_DIFFS) {
      await supabase.from("code_changes").insert({
        session_id: sessionId,
        file_path: diff.file_path,
        diff_content: diff.diff_content,
        change_type: diff.change_type,
        additions: diff.additions,
        deletions: diff.deletions,
        review_status: "approved",
      });
    }

    await completeSession(supabase, pipelineId, sessionId, totalTokens);
  } catch (err) {
    console.error(`[simulator] Error during simulation:`, err);
    await failSession(supabase, pipelineId, sessionId, totalTokens);
  }
}

async function completeSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pipelineId: string,
  sessionId: string,
  totalTokens: number
): Promise<void> {
  await supabase
    .from("sessions")
    .update({
      status: "completed",
      token_usage: totalTokens,
      completed_at: new Date().toISOString(),
      metadata: { progress_percent: 100 },
    })
    .eq("id", sessionId);

  await supabase
    .from("pipelines")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", pipelineId);
}

async function failSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pipelineId: string,
  sessionId: string,
  totalTokens: number
): Promise<void> {
  await supabase
    .from("sessions")
    .update({
      status: "failed",
      token_usage: totalTokens,
      completed_at: new Date().toISOString(),
      metadata: { progress_percent: 0, error: "Simulation failed" },
    })
    .eq("id", sessionId);

  await supabase
    .from("pipelines")
    .update({ status: "failed" })
    .eq("id", pipelineId);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
