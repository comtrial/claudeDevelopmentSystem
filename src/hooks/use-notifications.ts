"use client";

import { useCallback } from "react";
import { toast } from "sonner";

type NotificationLevel = "info" | "success" | "warning" | "error";

interface NotifyOptions {
  title: string;
  description?: string;
  level?: NotificationLevel;
  duration?: number;
}

export function useNotifications() {
  const notify = useCallback(
    ({ title, description, level = "info", duration }: NotifyOptions) => {
      const opts = { description, duration };

      switch (level) {
        case "success":
          toast.success(title, opts);
          break;
        case "warning":
          toast.warning(title, opts);
          break;
        case "error":
          toast.error(title, opts);
          break;
        default:
          toast.info(title, opts);
          break;
      }
    },
    []
  );

  const notifyFromWebSocket = useCallback(
    (event: string, payload: Record<string, unknown>) => {
      switch (event) {
        case "pipeline:status": {
          const status = payload.status as string;
          const pipelineId = payload.pipeline_id as string;
          const shortId = pipelineId?.slice(0, 8) ?? "unknown";

          if (status === "completed") {
            toast.success(`Pipeline ${shortId} completed`);
          } else if (status === "failed") {
            toast.error(`Pipeline ${shortId} failed`);
          }
          break;
        }
        case "agent:log": {
          const level = payload.level as string;
          if (level === "error") {
            toast.error(payload.message as string);
          }
          break;
        }
      }
    },
    []
  );

  return { notify, notifyFromWebSocket };
}
