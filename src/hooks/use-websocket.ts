"use client";

import { useEffect, useRef, useState, useCallback, useReducer } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "reconnecting";

interface UseWebSocketOptions {
  channelName: string;
  enabled?: boolean;
  onMessage?: (event: string, payload: Record<string, unknown>) => void;
  onStatusChange?: (status: ConnectionStatus) => void;
  maxRetries?: number;
}

interface UseWebSocketReturn {
  status: ConnectionStatus;
  send: (event: string, payload: Record<string, unknown>) => void;
  reconnect: () => void;
}

const BASE_DELAY = 1000;
const MAX_DELAY = 30000;

function getBackoffDelay(attempt: number): number {
  const delay = Math.min(BASE_DELAY * Math.pow(2, attempt), MAX_DELAY);
  return delay + Math.random() * delay * 0.25;
}

export function useWebSocket({
  channelName,
  enabled = true,
  onMessage,
  onStatusChange,
  maxRetries = 5,
}: UseWebSocketOptions): UseWebSocketReturn {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [reconnectKey, forceReconnect] = useReducer((x: number) => x + 1, 0);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMessageRef = useRef(onMessage);
  const onStatusChangeRef = useRef(onStatusChange);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    retryCountRef.current = 0;

    function updateStatus(newStatus: ConnectionStatus) {
      if (cancelled) return;
      setStatus(newStatus);
      onStatusChangeRef.current?.(newStatus);
    }

    function doSubscribe() {
      if (cancelled) return;

      if (channelRef.current) {
        const supabase = createClient();
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      updateStatus("connecting");

      const supabase = createClient();
      const channel = supabase.channel(channelName);

      channel
        .on("broadcast", { event: "*" }, (payload) => {
          if (cancelled) return;
          onMessageRef.current?.(
            payload.event,
            payload.payload as Record<string, unknown>
          );
        })
        .subscribe((subscribeStatus) => {
          if (cancelled) return;

          if (subscribeStatus === "SUBSCRIBED") {
            updateStatus("connected");
            retryCountRef.current = 0;
          } else if (subscribeStatus === "CHANNEL_ERROR") {
            updateStatus("disconnected");
            if (retryCountRef.current < maxRetries) {
              const delay = getBackoffDelay(retryCountRef.current);
              retryCountRef.current += 1;
              updateStatus("reconnecting");
              retryTimerRef.current = setTimeout(doSubscribe, delay);
            }
          } else if (subscribeStatus === "CLOSED") {
            updateStatus("disconnected");
          }
        });

      channelRef.current = channel;
    }

    doSubscribe();

    return () => {
      cancelled = true;
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      if (channelRef.current) {
        const supabase = createClient();
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [channelName, enabled, maxRetries, reconnectKey]);

  const send = useCallback(
    (event: string, payload: Record<string, unknown>) => {
      if (channelRef.current && status === "connected") {
        channelRef.current.send({
          type: "broadcast",
          event,
          payload,
        });
      }
    },
    [status]
  );

  const reconnect = useCallback(() => {
    forceReconnect();
  }, []);

  return {
    status,
    send,
    reconnect,
  };
}
