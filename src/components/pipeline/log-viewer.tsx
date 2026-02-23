"use client";

import { useEffect, useRef, useState, useCallback, useDeferredValue } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { usePipelineStore, selectLogs, type ActiveLog } from "@/stores/pipeline-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { ArrowDownToLine, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogViewerProps {
  pipelineId: string;
  /** If provided, fetch initial log history from API */
  fetchInitial?: boolean;
}

// ── Level colors ────────────────────────────────────────────────────────────
const LEVEL_COLORS: Record<string, string> = {
  info: "text-blue-500",
  warn: "text-yellow-500",
  error: "text-red-500",
  debug: "text-gray-400",
  system: "text-purple-500",
};

const LEVEL_BG: Record<string, string> = {
  error: "bg-red-500/5",
  warn: "bg-yellow-500/5",
};

const LEVEL_BADGE: Record<string, string> = {
  info: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  warn: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  error: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  debug: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  system: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
};

const LEVELS = ["info", "warn", "error", "debug", "system"] as const;

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    return [
      String(d.getHours()).padStart(2, "0"),
      String(d.getMinutes()).padStart(2, "0"),
      String(d.getSeconds()).padStart(2, "0"),
    ].join(":");
  } catch {
    return "--:--:--";
  }
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debouncedValue;
}

export function LogViewer({ pipelineId, fetchInitial = true }: LogViewerProps) {
  const allLogs = usePipelineStore(selectLogs);
  const appendLog = usePipelineStore((s) => s.appendLog);

  const [searchInput, setSearchInput] = useState("");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [autoScroll, setAutoScroll] = useState(true);

  const debouncedSearch = useDebounce(searchInput, 300);
  const deferredSearch = useDeferredValue(debouncedSearch);

  // Fetch initial log history
  useEffect(() => {
    if (!fetchInitial || !pipelineId) return;

    fetch(`/api/pipelines/${pipelineId}/logs?limit=200`)
      .then((r) => r.json())
      .then((res) => {
        if (res.data?.logs) {
          for (const log of res.data.logs) {
            appendLog(log as ActiveLog);
          }
        }
      })
      .catch(() => {/* silently ignore initial fetch errors */});
  }, [pipelineId, fetchInitial, appendLog]);

  // Derive unique agent roles for filter dropdown
  const agentRoles = Array.from(new Set(allLogs.map((l) => l.agent_role))).sort();

  // Filter logs
  const filteredLogs = allLogs.filter((log) => {
    if (agentFilter !== "all" && log.agent_role !== agentFilter) return false;
    if (levelFilter !== "all" && log.level !== levelFilter) return false;
    if (
      deferredSearch &&
      !log.message.toLowerCase().includes(deferredSearch.toLowerCase())
    )
      return false;
    return true;
  });

  // Virtual scroll setup
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredLogs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 10,
  });

  // Auto-scroll to bottom when new logs arrive
  const prevCountRef = useRef(filteredLogs.length);
  useEffect(() => {
    if (autoScroll && filteredLogs.length > prevCountRef.current) {
      rowVirtualizer.scrollToIndex(filteredLogs.length - 1, { align: "end" });
    }
    prevCountRef.current = filteredLogs.length;
  }, [filteredLogs.length, autoScroll, rowVirtualizer]);

  // Detect manual scroll to pause auto-scroll
  const handleScroll = useCallback(() => {
    const el = parentRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom > 80) {
      setAutoScroll(false);
    }
  }, []);

  return (
    <div className="flex flex-col h-full bg-background font-mono text-xs">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b bg-muted/30 flex-wrap">
        <Input
          placeholder="로그 검색..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="h-7 text-xs w-40 sm:w-56"
        />

        <Select value={agentFilter} onValueChange={setAgentFilter}>
          <SelectTrigger className="h-7 text-xs w-28">
            <SelectValue placeholder="에이전트" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 에이전트</SelectItem>
            {agentRoles.map((r) => (
              <SelectItem key={r} value={r}>
                {r.toUpperCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="h-7 text-xs w-24">
            <SelectValue placeholder="레벨" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 레벨</SelectItem>
            {LEVELS.map((l) => (
              <SelectItem key={l} value={l}>
                {l.toUpperCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-muted-foreground tabular-nums">
            {filteredLogs.length.toLocaleString()}줄
          </span>

          <Toggle
            pressed={autoScroll}
            onPressedChange={setAutoScroll}
            size="sm"
            className="h-7 text-xs gap-1"
            aria-label="자동 스크롤 토글"
          >
            {autoScroll ? (
              <>
                <ArrowDownToLine className="h-3 w-3" />
                자동
              </>
            ) : (
              <>
                <Pause className="h-3 w-3" />
                정지
              </>
            )}
          </Toggle>

          {!autoScroll && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                setAutoScroll(true);
                rowVirtualizer.scrollToIndex(filteredLogs.length - 1, { align: "end" });
              }}
            >
              맨 아래로
            </Button>
          )}
        </div>
      </div>

      {/* Virtual list */}
      <div
        ref={parentRef}
        className="flex-1 overflow-auto min-h-0 h-80"
        onScroll={handleScroll}
      >
        {filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            로그가 없습니다.
          </div>
        ) : (
          <div
            style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const log = filteredLogs[virtualRow.index];
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  className={cn(
                    "absolute top-0 left-0 w-full flex items-start gap-2 px-3 py-1 hover:bg-muted/40 transition-colors",
                    LEVEL_BG[log.level]
                  )}
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                >
                  {/* Timestamp */}
                  <span className="text-muted-foreground shrink-0 tabular-nums select-none">
                    {formatTimestamp(log.created_at)}
                  </span>

                  {/* Agent badge */}
                  <span className="shrink-0 uppercase font-semibold text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    {log.agent_role}
                  </span>

                  {/* Level badge */}
                  <Badge
                    variant="outline"
                    className={cn(
                      "shrink-0 text-[10px] px-1 py-0 h-4 border-0",
                      LEVEL_BADGE[log.level] ?? LEVEL_BADGE.debug
                    )}
                  >
                    {log.level.toUpperCase()}
                  </Badge>

                  {/* Message */}
                  <span className={cn("flex-1 break-all", LEVEL_COLORS[log.level] ?? "")}>
                    {log.message}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
