"use client";

import type { SessionSummary } from "@/types/session";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface SessionSelectorProps {
  sessions: SessionSummary[];
  activeSessionId: string;
  onSelect: (sessionId: string) => void;
}

const statusDotColor: Record<string, string> = {
  running: "bg-green-500 animate-pulse",
  completed: "bg-blue-500",
  failed: "bg-red-500",
  cancelled: "bg-gray-400",
  paused: "bg-yellow-500",
  initializing: "bg-gray-400",
};

function sessionLabel(s: SessionSummary): string {
  return s.session_number === 1 ? "초기 실행" : `후속 #${s.session_number}`;
}

export function SessionSelector({ sessions, activeSessionId, onSelect }: SessionSelectorProps) {
  // Don't render if there's only one session
  if (sessions.length <= 1) return null;

  // Use tabs for 3 or fewer sessions
  if (sessions.length <= 3) {
    return (
      <Tabs value={activeSessionId} onValueChange={onSelect}>
        <TabsList className="h-8">
          {sessions.map((s) => (
            <TabsTrigger key={s.id} value={s.id} className="text-xs gap-1.5 px-3">
              <span
                className={cn(
                  "inline-block h-2 w-2 rounded-full shrink-0",
                  statusDotColor[s.status] ?? "bg-gray-400"
                )}
              />
              {sessionLabel(s)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    );
  }

  // Use dropdown for 4+ sessions
  const activeSession = sessions.find((s) => s.id === activeSessionId);

  return (
    <Select value={activeSessionId} onValueChange={onSelect}>
      <SelectTrigger className="h-8 w-48 text-xs">
        <SelectValue>
          {activeSession ? (
            <span className="flex items-center gap-1.5">
              <span
                className={cn(
                  "inline-block h-2 w-2 rounded-full shrink-0",
                  statusDotColor[activeSession.status] ?? "bg-gray-400"
                )}
              />
              {sessionLabel(activeSession)}
            </span>
          ) : (
            "세션 선택"
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {sessions.map((s) => (
          <SelectItem key={s.id} value={s.id} className="text-xs">
            <span className="flex items-center gap-1.5">
              <span
                className={cn(
                  "inline-block h-2 w-2 rounded-full shrink-0",
                  statusDotColor[s.status] ?? "bg-gray-400"
                )}
              />
              {sessionLabel(s)}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
