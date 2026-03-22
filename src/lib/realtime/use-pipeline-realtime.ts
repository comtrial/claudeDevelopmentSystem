"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePipelineStore } from "@/stores/pipeline-store";
import type { ActiveAgent, ActiveLog } from "@/stores/pipeline-store";
import type { TaskStatus } from "@/types/pipeline";

/**
 * Subscribes to Supabase Realtime for a given pipeline:
 * 1. `pipeline:{id}` — pipelines table UPDATE events
 * 2. `agents:{id}` — agents table INSERT/UPDATE/DELETE events
 * 3. `logs:{id}` — agent_logs table INSERT events (via latest session)
 * 4. `tasks:{id}` — tasks table UPDATE events
 *
 * Updates pipeline-store state on each event.
 * Tracks connection status.
 */
export function usePipelineRealtime(pipelineId: string) {
  const {
    updatePipelineStatus,
    updateAgentStatus,
    updateTaskStatus,
    appendLog,
    setConnectionStatus,
  } = usePipelineStore.getState();

  useEffect(() => {
    if (!pipelineId) return;

    const supabase = createClient();
    setConnectionStatus("connecting");

    // Channel 1: pipeline status updates
    const pipelineChannel = supabase
      .channel(`pipeline:${pipelineId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "pipelines",
          filter: `id=eq.${pipelineId}`,
        },
        (payload) => {
          const newRow = payload.new as Record<string, unknown>;
          updatePipelineStatus(newRow);
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConnectionStatus("connected");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setConnectionStatus("disconnected");
        }
      });

    // Channel 2: agent status updates
    const agentsChannel = supabase
      .channel(`agents:${pipelineId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "agents",
          filter: `pipeline_id=eq.${pipelineId}`,
        },
        (payload) => {
          if (payload.eventType === "UPDATE" || payload.eventType === "INSERT") {
            const row = payload.new as Record<string, unknown>;
            const agentUpdate: Partial<ActiveAgent> & { id: string } = {
              id: row.id as string,
              status: (row.status as ActiveAgent["status"]) ?? "idle",
              currentTask: (row.current_task as string | null) ?? null,
              progress: (row.progress as number) ?? 0,
              lastActivity: (row.updated_at as string) ?? new Date().toISOString(),
            };
            updateAgentStatus(agentUpdate);
          }
        }
      )
      .subscribe();

    // Channel 3: new log entries
    const logsChannel = supabase
      .channel(`logs:${pipelineId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "agent_logs",
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const metadata = (row.metadata as Record<string, unknown>) ?? {};

          const log: ActiveLog = {
            id: row.id as string | number,
            session_id: row.session_id as string,
            agent_role: row.agent_role as string,
            level: (row.level as ActiveLog["level"]) ?? "info",
            message: row.message as string,
            metadata,
            created_at: row.created_at as string,
          };
          appendLog(log);
        }
      )
      .subscribe();

    // Channel 4: task status updates
    const tasksChannel = supabase
      .channel(`tasks:${pipelineId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tasks",
          filter: `pipeline_id=eq.${pipelineId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          updateTaskStatus(
            row.id as string,
            row.status as TaskStatus,
            (row.output_data as Record<string, unknown>) ?? undefined
          );
        }
      )
      .subscribe();

    return () => {
      setConnectionStatus("disconnected");
      supabase.removeChannel(pipelineChannel);
      supabase.removeChannel(agentsChannel);
      supabase.removeChannel(logsChannel);
      supabase.removeChannel(tasksChannel);
    };
  }, [pipelineId, updatePipelineStatus, updateAgentStatus, updateTaskStatus, appendLog, setConnectionStatus]);
}
