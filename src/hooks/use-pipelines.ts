"use client";

import { useEffect, useRef, useCallback } from "react";
import { usePipelineStore } from "@/stores/pipeline-store";
import { usePipelineRealtime } from "@/hooks/use-pipeline-realtime";
import type { PipelineSummary } from "@/types/pipeline-summary";
import type { ApiResponse } from "@/types/api";

const MAX_RETRIES = 3;
const RETRY_DELAY = 3000;

interface UsePipelinesOptions {
  userId: string | undefined;
}

export function usePipelines({ userId }: UsePipelinesOptions) {
  const pipelines = usePipelineStore((s) => s.pipelines);
  const isLoading = usePipelineStore((s) => s.isLoading);
  const error = usePipelineStore((s) => s.error);
  const setPipelines = usePipelineStore((s) => s.setPipelines);
  const setLoading = usePipelineStore((s) => s.setLoading);
  const setError = usePipelineStore((s) => s.setError);

  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Connect realtime
  usePipelineRealtime(userId);

  const fetchPipelines = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/pipelines?limit=50");
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const json: ApiResponse<PipelineSummary[]> = await res.json();

      if (json.error) {
        throw new Error(json.error.message);
      }

      setPipelines(json.data ?? []);
      retryCountRef.current = 0;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch pipelines";
      setError(message);

      if (retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current += 1;
        retryTimerRef.current = setTimeout(() => {
          fetchPipelines();
        }, RETRY_DELAY);
      }
    } finally {
      setLoading(false);
    }
  }, [setPipelines, setLoading, setError]);

  useEffect(() => {
    if (!userId) return;

    fetchPipelines();

    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [userId, fetchPipelines]);

  return {
    pipelines,
    isLoading,
    error,
    refetch: fetchPipelines,
  };
}
