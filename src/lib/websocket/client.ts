import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export function subscribeToChannel(
  channelName: string,
  table: string,
  filter?: string,
  callback?: (payload: unknown) => void
): RealtimeChannel {
  const supabase = createClient();
  const channel = supabase
    .channel(channelName)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table,
        filter,
      },
      (payload) => {
        callback?.(payload);
      }
    )
    .subscribe();
  return channel;
}

export function unsubscribeChannel(channel: RealtimeChannel) {
  channel.unsubscribe();
}
