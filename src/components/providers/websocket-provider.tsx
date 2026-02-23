"use client";

import { createContext, useContext, useCallback, type ReactNode } from "react";
import {
  useWebSocket,
  type ConnectionStatus,
} from "@/hooks/use-websocket";
import { usePipelineStore } from "@/stores/pipeline-store";
import type { PipelineStatus } from "@/types/pipeline";

interface WebSocketContextValue {
  status: ConnectionStatus;
  send: (event: string, payload: Record<string, unknown>) => void;
  reconnect: () => void;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

interface WebSocketProviderProps {
  channelName: string;
  children: ReactNode;
  enabled?: boolean;
}

export function WebSocketProvider({
  channelName,
  children,
  enabled = true,
}: WebSocketProviderProps) {
  const updatePipeline = usePipelineStore(
    (s) => s.updatePipeline
  );

  const handleMessage = useCallback(
    (event: string, payload: Record<string, unknown>) => {
      switch (event) {
        case "pipeline:status": {
          const { pipeline_id, status } = payload as {
            pipeline_id: string;
            status: PipelineStatus;
          };
          updatePipeline(pipeline_id, { status });
          break;
        }
        // Additional event types can be added here
      }
    },
    [updatePipeline]
  );

  const { status, send, reconnect } = useWebSocket({
    channelName,
    enabled,
    onMessage: handleMessage,
  });

  return (
    <WebSocketContext.Provider value={{ status, send, reconnect }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketContext(): WebSocketContextValue {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error(
      "useWebSocketContext must be used within a WebSocketProvider"
    );
  }
  return context;
}
