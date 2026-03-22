"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePipelineStore } from "@/stores/pipeline-store";
import type { PipelineStatus } from "@/types/pipeline";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface PipelinePayload {
  id: string;
  status: PipelineStatus;
  title: string;
  description: string | null;
  updated_at: string;
}

interface SessionPayload {
  id: string;
  pipeline_id: string;
  status: string;
  token_usage: number;
  token_limit: number;
}

const RECONNECT_DELAY = 3000;

export function usePipelineRealtime(userId: string | undefined) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updatePipeline = usePipelineStore((s) => s.updatePipeline);
  const updateSession = usePipelineStore((s) => s.updateSession);

  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();

    function subscribe() {
      // Clean up previous channel
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }

      const channel = supabase
        .channel(`pipelines:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "pipelines",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const row = payload.new as PipelinePayload;
            updatePipeline(row.id, {
              status: row.status,
              title: row.title,
              description: row.description,
              updated_at: row.updated_at,
            });
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "sessions",
          },
          (payload) => {
            const row = payload.new as SessionPayload;
            updateSession(row.pipeline_id, {
              id: row.id,
              status: row.status,
              token_usage: row.token_usage,
              token_limit: row.token_limit,
              progress_percent:
                row.token_limit > 0
                  ? Math.round((row.token_usage / row.token_limit) * 100)
                  : 0,
            });
          }
        )
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR") {
            reconnectTimerRef.current = setTimeout(() => {
              subscribe();
            }, RECONNECT_DELAY);
          }
        });

      channelRef.current = channel;
    }

    subscribe();

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId, updatePipeline, updateSession]);
}
