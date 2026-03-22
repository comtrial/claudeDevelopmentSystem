"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
  MinusCircle,
  ChevronDown,
  ChevronUp,
  ListChecks,
  Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Task, TaskStatus } from "@/types/pipeline";

interface TaskProgressTimelineProps {
  tasks: Task[];
  startedAt?: string | null;
}

const MAX_VISIBLE_DEFAULT = 5;

const STATUS_CONFIG: Record<
  TaskStatus,
  {
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    lineColor: string;
    label: string;
  }
> = {
  pending: {
    icon: Circle,
    color: "text-muted-foreground",
    lineColor: "bg-muted-foreground/20",
    label: "대기",
  },
  in_progress: {
    icon: Loader2,
    color: "text-running",
    lineColor: "bg-running/40",
    label: "진행 중",
  },
  completed: {
    icon: CheckCircle2,
    color: "text-healthy",
    lineColor: "bg-healthy/40",
    label: "완료",
  },
  failed: {
    icon: XCircle,
    color: "text-critical",
    lineColor: "bg-critical/40",
    label: "실패",
  },
  skipped: {
    icon: MinusCircle,
    color: "text-muted-foreground/60",
    lineColor: "bg-muted-foreground/20",
    label: "건너뜀",
  },
};

const ROLE_BADGE_STYLE: Record<string, string> = {
  pm: "bg-purple-500/10 text-purple-500 border-purple-500/30",
  engineer: "bg-blue-500/10 text-blue-500 border-blue-500/30",
  reviewer: "bg-green-500/10 text-green-500 border-green-500/30",
};

const COMPLEXITY_STYLE: Record<string, { label: string; className: string }> = {
  low: { label: "Low", className: "bg-green-500/10 text-green-600 border-green-500/30" },
  medium: { label: "Mid", className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30" },
  high: { label: "High", className: "bg-red-500/10 text-red-600 border-red-500/30" },
};

function formatDuration(startStr: string, endStr: string): string {
  const start = new Date(startStr).getTime();
  const end = new Date(endStr).getTime();
  const diffMs = end - start;
  if (diffMs < 0 || isNaN(diffMs)) return "";

  const secs = Math.floor(diffMs / 1000);
  if (secs < 60) return `${secs}초`;
  const mins = Math.floor(secs / 60);
  const remainSecs = secs % 60;
  if (mins < 60) return `${mins}분 ${remainSecs}초`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${hours}시간 ${remainMins}분`;
}

function formatElapsedFromMs(diffMs: number): string {
  if (diffMs < 0 || isNaN(diffMs)) return "0초";
  const secs = Math.floor(diffMs / 1000);
  if (secs < 60) return `${secs}초째`;
  const mins = Math.floor(secs / 60);
  const remainSecs = secs % 60;
  if (mins < 60) return `${mins}분 ${remainSecs}초째`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${hours}시간 ${remainMins}분째`;
}

function useElapsedTimer(startedAt: string) {
  const calc = useCallback(
    () => formatElapsedFromMs(Date.now() - new Date(startedAt).getTime()),
    [startedAt]
  );
  const [elapsed, setElapsed] = useState(() => calc());

  useEffect(() => {
    const id = setInterval(() => setElapsed(calc()), 1000);
    return () => clearInterval(id);
  }, [calc]);

  return elapsed;
}

function ElapsedTimer({ startedAt }: { startedAt: string }) {
  const elapsed = useElapsedTimer(startedAt);

  return (
    <span
      className="flex items-center gap-0.5 text-[10px] text-running tabular-nums"
      data-testid="task-elapsed-timer"
    >
      <Clock className="h-2.5 w-2.5" />
      {elapsed}
    </span>
  );
}

function TotalElapsedTimer({ startedAt }: { startedAt: string }) {
  const elapsed = useElapsedTimer(startedAt);

  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-running/10 px-1.5 py-0.5 text-[11px] font-medium text-running tabular-nums">
      <Clock className="h-3 w-3" />
      총 {elapsed}
    </span>
  );
}

function getOutputSummary(outputData: Record<string, unknown>): string | null {
  if (!outputData || Object.keys(outputData).length === 0) return null;

  // Common output fields
  if (typeof outputData.summary === "string") return outputData.summary;
  if (typeof outputData.result === "string") return outputData.result;
  if (typeof outputData.message === "string") return outputData.message;

  // Stringify small objects
  const json = JSON.stringify(outputData);
  if (json.length <= 200) return json;
  return json.substring(0, 197) + "...";
}

function TaskNode({
  task,
  isLast,
  isExpanded,
  onToggle,
}: {
  task: Task;
  isLast: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const config = STATUS_CONFIG[task.status];
  const Icon = config.icon;
  const agentRole = (task.input_data?.agent_role as string) ?? null;
  const complexity = (task.input_data?.estimated_complexity as string) ?? null;
  const acceptanceCriteria = (task.input_data?.acceptance_criteria as string) ?? null;
  const complexityConfig = complexity ? COMPLEXITY_STYLE[complexity] : null;

  const hasOutput = task.output_data && Object.keys(task.output_data).length > 0;
  const isClickable = task.status === "completed" || task.status === "failed";
  const duration = (task.status === "completed" || task.status === "failed")
    ? formatDuration(task.created_at, task.updated_at)
    : null;
  const outputSummary = hasOutput ? getOutputSummary(task.output_data) : null;

  return (
    <div className="flex gap-3" data-testid={`task-node-${task.id}`}>
      {/* Timeline column: icon + connecting line */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "flex items-center justify-center rounded-full",
            task.status === "in_progress" && "animate-spin"
          )}
        >
          <Icon className={cn("h-4 w-4 shrink-0", config.color)} />
        </div>
        {!isLast && (
          <div
            className={cn(
              "w-px flex-1 min-h-4",
              config.lineColor
            )}
          />
        )}
      </div>

      {/* Content column */}
      <div className={cn("pb-4 min-w-0 flex-1", isLast && "pb-0")}>
        <div
          className={cn(
            "flex items-center gap-2 flex-wrap",
            isClickable && "cursor-pointer"
          )}
          onClick={isClickable ? onToggle : undefined}
          role={isClickable ? "button" : undefined}
          tabIndex={isClickable ? 0 : undefined}
          onKeyDown={isClickable ? (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onToggle();
            }
          } : undefined}
        >
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <p
                  className={cn(
                    "text-sm font-medium truncate max-w-[200px] sm:max-w-[300px]",
                    task.status === "pending" && "text-muted-foreground",
                    task.status === "in_progress" && "text-foreground",
                    task.status === "completed" && "text-foreground",
                    task.status === "failed" && "text-critical"
                  )}
                >
                  {task.title}
                </p>
              </TooltipTrigger>
              {task.description && (
                <TooltipContent side="right" className="max-w-xs">
                  <p className="text-xs">{task.description}</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>

          {agentRole && (
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] px-1.5 py-0",
                ROLE_BADGE_STYLE[agentRole] ?? ""
              )}
            >
              {agentRole.toUpperCase()}
            </Badge>
          )}

          {complexityConfig && (
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] px-1.5 py-0",
                complexityConfig.className
              )}
              data-testid="task-complexity-badge"
            >
              {complexityConfig.label}
            </Badge>
          )}

          <span className={cn("text-[10px]", config.color)}>
            {config.label}
          </span>

          {/* Elapsed timer for in_progress tasks */}
          {task.status === "in_progress" && (
            <ElapsedTimer startedAt={task.updated_at} />
          )}

          {/* Duration for completed/failed tasks */}
          {duration && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Clock className="h-2.5 w-2.5" />
              {duration}
            </span>
          )}

          {/* Expand indicator for clickable tasks */}
          {isClickable && hasOutput && (
            <ChevronDown className={cn(
              "h-3 w-3 text-muted-foreground transition-transform",
              isExpanded && "rotate-180"
            )} />
          )}
        </div>

        {/* Acceptance criteria */}
        {acceptanceCriteria && (task.status === "completed" || task.status === "in_progress") && (
          <p className="text-[11px] text-muted-foreground/80 mt-0.5 italic">
            ✓ {acceptanceCriteria}
          </p>
        )}

        {/* Expanded output preview */}
        {isExpanded && outputSummary && (
          <div
            className="mt-2 rounded-md border bg-muted/30 p-2.5 text-xs text-muted-foreground whitespace-pre-wrap break-words"
            data-testid="task-output-preview"
          >
            {outputSummary}
          </div>
        )}
      </div>
    </div>
  );
}

export function TaskProgressTimeline({ tasks, startedAt }: TaskProgressTimelineProps) {
  const [expanded, setExpanded] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  if (tasks.length === 0) return null;

  const sorted = [...tasks].sort((a, b) => a.order_index - b.order_index);
  const totalTasks = sorted.length;
  const completedCount = sorted.filter((t) => t.status === "completed").length;
  const inProgressCount = sorted.filter((t) => t.status === "in_progress").length;
  const failedCount = sorted.filter((t) => t.status === "failed").length;

  // Determine pipeline timing
  const isAllDone = completedCount + failedCount === totalTasks;
  const isInProgress = inProgressCount > 0;

  // Resolve the pipeline start time: prefer explicit startedAt, fallback to first task
  const effectiveStartedAt = startedAt ?? (() => {
    const allTimes = sorted.map((t) => new Date(t.created_at).getTime()).filter((t) => !isNaN(t));
    return allTimes.length > 0 ? new Date(Math.min(...allTimes)).toISOString() : null;
  })();

  // Total duration for completed pipelines (static)
  const totalDuration = (() => {
    if (!isAllDone || !effectiveStartedAt) return null;
    const finishedTasks = sorted.filter((t) => t.status === "completed" || t.status === "failed");
    if (finishedTasks.length === 0) return null;
    const lastEnd = Math.max(...finishedTasks.map((t) => new Date(t.updated_at).getTime()));
    if (isNaN(lastEnd)) return null;
    return formatDuration(effectiveStartedAt, new Date(lastEnd).toISOString());
  })();

  // Determine visible tasks
  const needsCollapse = totalTasks > MAX_VISIBLE_DEFAULT;
  const visibleTasks = expanded || !needsCollapse
    ? sorted
    : (() => {
        const activeIdx = sorted.findIndex((t) => t.status === "in_progress");
        const focusIdx = activeIdx >= 0 ? activeIdx : completedCount;
        const start = Math.max(0, focusIdx - 1);
        const end = Math.min(totalTasks, start + MAX_VISIBLE_DEFAULT);
        return sorted.slice(start, end);
      })();

  return (
    <div data-testid="task-progress-timeline">
      {/* Section header */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <ListChecks className="h-4 w-4" />
          태스크 진행 상황
          <span className="text-xs font-normal normal-case tracking-normal ml-1">
            {completedCount}/{totalTasks} 완료
            {inProgressCount > 0 && ` · ${inProgressCount} 진행 중`}
            {failedCount > 0 && ` · ${failedCount} 실패`}
          </span>
        </h2>
        {/* Total elapsed: live timer when running, static when done */}
        {isInProgress && effectiveStartedAt && (
          <TotalElapsedTimer startedAt={effectiveStartedAt} />
        )}
        {isAllDone && totalDuration && (
          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">
            <Clock className="h-3 w-3" />
            총 {totalDuration}
          </span>
        )}
      </div>

      {/* Overall task progress bar */}
      <div className="mb-4">
        <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
          {completedCount > 0 && (
            <div
              className="bg-healthy transition-all duration-500"
              style={{ width: `${(completedCount / totalTasks) * 100}%` }}
            />
          )}
          {inProgressCount > 0 && (
            <div
              className="bg-running animate-pulse transition-all duration-500"
              style={{ width: `${(inProgressCount / totalTasks) * 100}%` }}
            />
          )}
          {failedCount > 0 && (
            <div
              className="bg-critical transition-all duration-500"
              style={{ width: `${(failedCount / totalTasks) * 100}%` }}
            />
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="pl-1">
        {visibleTasks.map((task, idx) => (
          <TaskNode
            key={task.id}
            task={task}
            isLast={idx === visibleTasks.length - 1}
            isExpanded={expandedTaskId === task.id}
            onToggle={() => setExpandedTaskId(
              expandedTaskId === task.id ? null : task.id
            )}
          />
        ))}
      </div>

      {/* Expand/collapse toggle */}
      {needsCollapse && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-2 ml-7"
          data-testid="task-timeline-toggle"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" />
              접기
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              전체 {totalTasks}개 보기
            </>
          )}
        </button>
      )}
    </div>
  );
}
