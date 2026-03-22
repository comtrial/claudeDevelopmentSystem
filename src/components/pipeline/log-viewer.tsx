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
import { ArrowDownToLine, Pause, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { mdComponents } from "./markdown-components";

interface LogViewerProps {
  pipelineId: string;
  /** If provided, fetch logs for this specific session */
  sessionId?: string;
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

// Detect truncated log messages with full_output in metadata
const TRUNCATION_PATTERN = /\.\.\. \((\d+)자 총 출력\)$/;

// Detect structured/preformatted text (box-drawing, ASCII art, indented blocks)
const STRUCTURED_PATTERN = /[│┃┆┊├┤┬┴┼╋▼▲►◄─═╭╮╯╰┌┐└┘║╔╗╚╝]|(?:^  +\S.*\n  +\S)/m;
function isStructuredText(text: string): boolean {
  if (STRUCTURED_PATTERN.test(text)) return true;
  // Multi-line text with consistent indentation (tree/diagram style)
  const lines = text.split("\n");
  if (lines.length >= 4) {
    const indented = lines.filter((l) => /^  +\S/.test(l)).length;
    if (indented >= 3) return true;
  }
  return false;
}

// Simple heuristic to detect markdown content in log messages
const MD_PATTERN = /(?:^#{1,6}\s|^\|.+\||\*\*.+\*\*|`.+`|^[-*]\s|^\d+\.\s|^>\s|```)/m;
function hasMarkdown(text: string): boolean {
  return MD_PATTERN.test(text);
}

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

// mdComponents imported from ./markdown-components

// ── Expand toggle button ─────────────────────────────────────────────────
function ExpandButton({
  isExpanded,
  label,
  onClick,
}: {
  isExpanded: boolean;
  label?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-0.5 mt-1 text-[10px] text-primary hover:underline cursor-pointer"
    >
      {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      {isExpanded ? "접기" : label ?? "전체 보기"}
    </button>
  );
}

// ── Log message with expand support ──────────────────────────────────────
function LogMessage({
  log,
  isExpanded,
  onToggleExpand,
}: {
  log: ActiveLog;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const fullOutput = (log.metadata as Record<string, unknown>)?.full_output as string | undefined;
  const isTruncated = TRUNCATION_PATTERN.test(log.message) && !!fullOutput;
  const displayText = isExpanded && fullOutput ? fullOutput : log.message;

  // 1) Structured/preformatted text (box-drawing, ASCII art, indented trees)
  if (isStructuredText(displayText)) {
    return (
      <div className={cn("flex-1 min-w-0", LEVEL_COLORS[log.level] ?? "")}>
        <pre className="text-xs leading-relaxed whitespace-pre-wrap break-words overflow-x-auto font-mono">
          {displayText}
        </pre>
        {isTruncated && (
          <ExpandButton
            isExpanded={isExpanded}
            label={log.message.match(TRUNCATION_PATTERN)?.[0]}
            onClick={onToggleExpand}
          />
        )}
      </div>
    );
  }

  // 2) Markdown content
  if (hasMarkdown(displayText)) {
    return (
      <div className={cn("flex-1 break-words min-w-0", LEVEL_COLORS[log.level] ?? "")}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
          {displayText}
        </ReactMarkdown>
        {isTruncated && (
          <ExpandButton
            isExpanded={isExpanded}
            label={log.message.match(TRUNCATION_PATTERN)?.[0]}
            onClick={onToggleExpand}
          />
        )}
      </div>
    );
  }

  // 3) Multi-line plain text (preserve line breaks)
  const isMultiLine = displayText.includes("\n");
  if (isMultiLine) {
    return (
      <div className={cn("flex-1 min-w-0", LEVEL_COLORS[log.level] ?? "")}>
        <pre className="text-xs leading-relaxed whitespace-pre-wrap break-words font-mono">
          {displayText}
        </pre>
        {isTruncated && (
          <ExpandButton
            isExpanded={isExpanded}
            label={log.message.match(TRUNCATION_PATTERN)?.[0]}
            onClick={onToggleExpand}
          />
        )}
      </div>
    );
  }

  // 4) Single-line plain text
  return (
    <span className={cn("flex-1 break-words", LEVEL_COLORS[log.level] ?? "")}>
      {isTruncated ? (
        <>
          {isExpanded ? displayText : log.message.replace(TRUNCATION_PATTERN, "")}
          <ExpandButton
            isExpanded={isExpanded}
            label={log.message.match(TRUNCATION_PATTERN)?.[0]}
            onClick={onToggleExpand}
          />
        </>
      ) : (
        displayText
      )}
    </span>
  );
}

export function LogViewer({ pipelineId, sessionId, fetchInitial = true }: LogViewerProps) {
  const allLogs = usePipelineStore(selectLogs);
  const appendLog = usePipelineStore((s) => s.appendLog);
  const clearLogs = usePipelineStore((s) => s.clearLogs);

  const [searchInput, setSearchInput] = useState("");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [autoScroll, setAutoScroll] = useState(true);

  const [expandedRows, setExpandedRows] = useState<Set<string | number>>(new Set());
  const debouncedSearch = useDebounce(searchInput, 300);
  const deferredSearch = useDeferredValue(debouncedSearch);

  const toggleExpand = useCallback((logId: string | number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(logId)) next.delete(logId);
      else next.add(logId);
      return next;
    });
  }, []);

  // Fetch log history and poll for new logs
  const lastLogIdRef = useRef<string | number | null>(null);
  useEffect(() => {
    if (!fetchInitial || !pipelineId) return;

    // Reset cursor and logs when session changes
    lastLogIdRef.current = null;
    clearLogs();

    let cancelled = false;

    const fetchLogs = async () => {
      try {
        const cursor = lastLogIdRef.current;
        let url = `/api/pipelines/${pipelineId}/logs?limit=200`;
        if (cursor) url += `&cursor=${cursor}`;
        if (sessionId) url += `&session_id=${sessionId}`;
        const r = await fetch(url);
        const res = await r.json();
        if (res.data?.logs && res.data.logs.length > 0) {
          for (const log of res.data.logs) {
            appendLog(log as ActiveLog);
          }
          const lastLog = res.data.logs[res.data.logs.length - 1];
          lastLogIdRef.current = lastLog.id;
        }
      } catch (err) {
        console.error("Failed to fetch logs:", err);
      }
    };

    // Initial fetch
    fetchLogs();

    // Poll every 3 seconds for new logs
    const interval = setInterval(() => {
      if (!cancelled) fetchLogs();
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pipelineId, sessionId, fetchInitial, appendLog, clearLogs]);

  // Derive unique agent roles for filter dropdown
  const agentRoles = Array.from(new Set(allLogs.map((l) => l.agent_role))).sort();

  // Filter logs and reverse (newest first)
  const filteredLogs = allLogs.filter((log) => {
    if (agentFilter !== "all" && log.agent_role !== agentFilter) return false;
    if (levelFilter !== "all" && log.level !== levelFilter) return false;
    if (
      deferredSearch &&
      !log.message.toLowerCase().includes(deferredSearch.toLowerCase())
    )
      return false;
    return true;
  }).slice().reverse();

  // Virtual scroll setup
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredLogs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 10,
  });

  // Auto-scroll to top when new logs arrive (newest first)
  const prevCountRef = useRef(filteredLogs.length);
  useEffect(() => {
    if (autoScroll && filteredLogs.length > prevCountRef.current) {
      rowVirtualizer.scrollToIndex(0, { align: "start" });
    }
    prevCountRef.current = filteredLogs.length;
  }, [filteredLogs.length, autoScroll, rowVirtualizer]);

  // Detect manual scroll to pause auto-scroll
  const handleScroll = useCallback(() => {
    const el = parentRef.current;
    if (!el) return;
    // Pause if user scrolls away from top
    if (el.scrollTop > 80) {
      setAutoScroll(false);
    }
  }, []);

  return (
    <div className="flex flex-col h-full bg-background font-mono text-xs">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-1 py-1.5 sm:p-2 border-b bg-muted/30 flex-wrap">
        <Input
          placeholder="로그 검색..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="h-8 sm:h-7 text-xs w-full sm:w-56"
        />

        <div className="flex items-center gap-2 flex-1 sm:flex-none">
          <Select value={agentFilter} onValueChange={setAgentFilter}>
            <SelectTrigger className="h-8 sm:h-7 text-xs w-full sm:w-28">
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
            <SelectTrigger className="h-8 sm:h-7 text-xs w-full sm:w-24">
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
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden sm:inline text-muted-foreground tabular-nums">
            {filteredLogs.length.toLocaleString()}줄
          </span>

          <Toggle
            pressed={autoScroll}
            onPressedChange={setAutoScroll}
            size="sm"
            className="h-8 sm:h-7 text-xs gap-1"
            aria-label="자동 스크롤 토글"
          >
            {autoScroll ? (
              <>
                <ArrowDownToLine className="h-3 w-3" />
                <span className="hidden sm:inline">자동</span>
              </>
            ) : (
              <>
                <Pause className="h-3 w-3" />
                <span className="hidden sm:inline">정지</span>
              </>
            )}
          </Toggle>

          {!autoScroll && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 sm:h-7 text-xs"
              onClick={() => {
                setAutoScroll(true);
                rowVirtualizer.scrollToIndex(0, { align: "start" });
              }}
            >
              최신으로
            </Button>
          )}
        </div>
      </div>

      {/* Virtual list */}
      <div
        ref={parentRef}
        className="flex-1 overflow-auto min-h-0 h-[50vh] sm:h-80"
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
                    "absolute top-0 left-0 w-full flex flex-col px-0 sm:px-3 py-1.5 border-b border-border/40 hover:bg-muted/40 transition-colors",
                    LEVEL_BG[log.level]
                  )}
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                >
                  {/* Top row: metadata */}
                  <div className="flex items-center gap-1.5 px-2 sm:px-0 mb-0.5">
                    <span className="shrink-0 uppercase font-semibold text-[10px] px-1 py-0 rounded bg-muted text-muted-foreground">
                      {log.agent_role}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "shrink-0 text-[10px] px-1 py-0 h-4 border-0",
                        LEVEL_BADGE[log.level] ?? LEVEL_BADGE.debug
                      )}
                    >
                      {log.level.toUpperCase()}
                    </Badge>
                    <span className="text-muted-foreground shrink-0 tabular-nums select-none text-[10px] ml-auto">
                      {formatTimestamp(log.created_at)}
                    </span>
                  </div>

                  {/* Bottom row: message */}
                  <div className="px-2 sm:px-0">
                    <LogMessage
                      log={log}
                      isExpanded={expandedRows.has(log.id)}
                      onToggleExpand={() => toggleExpand(log.id)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
