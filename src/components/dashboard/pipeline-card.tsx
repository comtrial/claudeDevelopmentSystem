"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardAction,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/utils/format-time";
import type { PipelineSummary } from "@/types/pipeline-summary";
import type { PipelineStatus } from "@/types/pipeline";

interface PipelineCardProps {
  pipeline: PipelineSummary;
  onClick: (id: string) => void;
}

const STATUS_LABEL: Record<PipelineStatus, string> = {
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  paused: "Paused",
  draft: "Draft",
  cancelled: "Cancelled",
};

const STATUS_STYLE: Record<PipelineStatus, string> = {
  running: "bg-running/10 text-running border-running/30",
  completed: "bg-healthy/10 text-healthy border-healthy/30",
  failed: "bg-critical/10 text-critical border-critical/30",
  paused: "bg-warning/10 text-warning border-warning/30",
  draft: "",
  cancelled: "bg-idle/10 text-idle border-idle/30",
};

const ROLE_LABEL: Record<string, string> = {
  pm: "PM",
  engineer: "Engineer",
  reviewer: "Reviewer",
};

function getTokenGaugeColor(percent: number): string {
  if (percent >= 90) return "text-critical";
  if (percent >= 80) return "text-danger";
  if (percent >= 60) return "text-warning";
  return "text-healthy";
}

export function PipelineCard({ pipeline, onClick }: PipelineCardProps) {
  const session = pipeline.latest_session;
  const progressPercent = session?.progress_percent ?? 0;
  const tokenPercent =
    session && session.token_limit > 0
      ? Math.round((session.token_usage / session.token_limit) * 100)
      : 0;

  return (
    <article
      aria-label={`${pipeline.title} - ${STATUS_LABEL[pipeline.status]}`}
      onClick={() => onClick(pipeline.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(pipeline.id);
        }
      }}
      tabIndex={0}
      role="button"
      className="cursor-pointer rounded-xl transition-shadow duration-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="h-full gap-4 py-4">
        <CardHeader className="gap-1 px-4">
          <CardTitle className="truncate text-sm">{pipeline.title}</CardTitle>
          <CardAction>
            <Badge
              variant="outline"
              className={cn(
                "text-[11px]",
                STATUS_STYLE[pipeline.status]
              )}
            >
              {STATUS_LABEL[pipeline.status]}
            </Badge>
          </CardAction>
        </CardHeader>

        <CardContent className="space-y-3 px-4">
          {/* Agent roles */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {pipeline.agent_summary.roles.map((role) => (
              <span
                key={role}
                className="flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <span
                  className={cn(
                    "inline-block size-1.5 rounded-full motion-reduce:animate-none",
                    pipeline.status === "running"
                      ? "bg-running animate-pulse"
                      : "bg-muted-foreground/40"
                  )}
                  aria-hidden="true"
                />
                {ROLE_LABEL[role] ?? role}
              </span>
            ))}
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <Progress
              value={progressPercent}
              className="h-1.5"
              aria-label={`진행률 ${progressPercent}%`}
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
            />
            <p className="text-right text-xs text-muted-foreground">
              {progressPercent}%
            </p>
          </div>
        </CardContent>

        <CardFooter className="gap-2 px-4 text-xs text-muted-foreground">
          {session && (
            <span
              className={getTokenGaugeColor(tokenPercent)}
              aria-label={`토큰 사용량 ${tokenPercent}%${tokenPercent >= 90 ? " - 위험" : tokenPercent >= 80 ? " - 높음" : ""}`}
            >
              세션: {tokenPercent}%
            </span>
          )}
          <span className="mx-1 text-border-subtle">|</span>
          <span>{formatRelativeTime(pipeline.updated_at)} 업데이트</span>
        </CardFooter>
      </Card>
    </article>
  );
}
