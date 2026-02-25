"use client";

import { ArrowUp, ArrowDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ParsedTask } from "@/types/wizard";

const ROLE_CONFIG = {
  pm: { label: "PM", className: "bg-agent-pm/15 text-agent-pm border-agent-pm/30" },
  engineer: { label: "Engineer", className: "bg-agent-engineer/15 text-agent-engineer border-agent-engineer/30" },
  reviewer: { label: "Reviewer", className: "bg-agent-reviewer/15 text-agent-reviewer border-agent-reviewer/30" },
} as const;

const COMPLEXITY_CONFIG = {
  low: { label: "Low", className: "bg-green-500/10 text-green-600 border-green-500/30" },
  medium: { label: "Mid", className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30" },
  high: { label: "High", className: "bg-red-500/10 text-red-600 border-red-500/30" },
} as const;

interface TaskCardProps {
  task: ParsedTask;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}

export function TaskCard({
  task,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onDelete,
}: TaskCardProps) {
  const role = ROLE_CONFIG[task.agent_role];
  const complexity = task.estimated_complexity ? COMPLEXITY_CONFIG[task.estimated_complexity] : null;

  return (
    <div className="group flex items-start gap-2 rounded-lg border bg-card p-3 transition-colors hover:border-border-strong/50 sm:gap-3 sm:p-4">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
        {task.order}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="text-sm font-medium leading-tight">{task.title}</h4>
          <span
            className={cn(
              "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase",
              role.className
            )}
          >
            {role.label}
          </span>
          {complexity && (
            <span
              className={cn(
                "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
                complexity.className
              )}
              data-testid="task-complexity-badge"
            >
              {complexity.label}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
          {task.description}
        </p>
        {task.acceptance_criteria && (
          <p className="mt-1 text-[11px] text-muted-foreground/80 italic">
            ✓ {task.acceptance_criteria}
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-center gap-0 opacity-100 sm:flex-row sm:gap-0.5 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onMoveUp}
          disabled={isFirst}
          aria-label="위로 이동"
        >
          <ArrowUp />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onMoveDown}
          disabled={isLast}
          aria-label="아래로 이동"
        >
          <ArrowDown />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onDelete}
          aria-label="삭제"
          className="text-destructive hover:text-destructive"
        >
          <X />
        </Button>
      </div>
    </div>
  );
}
