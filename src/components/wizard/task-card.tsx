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

  return (
    <div className="group flex items-start gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-border-strong/50">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
        {task.order}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium leading-tight">{task.title}</h4>
          <span
            className={cn(
              "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase",
              role.className
            )}
          >
            {role.label}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
          {task.description}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
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
