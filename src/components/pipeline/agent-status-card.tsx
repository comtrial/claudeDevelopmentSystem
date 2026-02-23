"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  BrainCircuit,
  Code2,
  Eye,
  FlaskConical,
  ClipboardList,
  Bot,
  Circle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface AgentStatusCardProps {
  agent: {
    id: string;
    name: string;
    role: "coder" | "reviewer" | "planner" | "tester" | "pm" | "engineer";
    status: "active" | "idle" | "completed" | "error";
    currentTask: string | null;
    progress: number;
    tokensUsed: number;
    tokenBudget: number;
    lastActivity: string;
  };
  onViewLogs: (agentId: string) => void;
}

const ROLE_ICONS: Record<AgentStatusCardProps["agent"]["role"], React.ComponentType<{ className?: string }>> = {
  pm: ClipboardList,
  planner: BrainCircuit,
  engineer: Code2,
  coder: Code2,
  reviewer: Eye,
  tester: FlaskConical,
};

const ROLE_LABELS: Record<AgentStatusCardProps["agent"]["role"], string> = {
  pm: "PM",
  planner: "Planner",
  engineer: "Engineer",
  coder: "Coder",
  reviewer: "Reviewer",
  tester: "Tester",
};

const ROLE_COLORS: Record<AgentStatusCardProps["agent"]["role"], string> = {
  pm: "text-purple-500",
  planner: "text-indigo-500",
  engineer: "text-blue-500",
  coder: "text-blue-500",
  reviewer: "text-green-500",
  tester: "text-orange-500",
};

function StatusIndicator({ status }: { status: AgentStatusCardProps["agent"]["status"] }) {
  if (status === "active") {
    return (
      <span className="relative flex h-3 w-3">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
      </span>
    );
  }
  if (status === "idle") {
    return <Circle className="h-3 w-3 fill-yellow-400 text-yellow-400" />;
  }
  if (status === "completed") {
    return <CheckCircle2 className="h-3 w-3 text-blue-500" />;
  }
  return <XCircle className="h-3 w-3 text-red-500" />;
}

const STATUS_LABELS: Record<AgentStatusCardProps["agent"]["status"], string> = {
  active: "활성",
  idle: "대기",
  completed: "완료",
  error: "오류",
};

export function AgentStatusCard({ agent, onViewLogs }: AgentStatusCardProps) {
  const RoleIcon = ROLE_ICONS[agent.role] ?? Bot;
  const roleColor = ROLE_COLORS[agent.role] ?? "text-muted-foreground";
  const tokenPercent =
    agent.tokenBudget > 0
      ? Math.round((agent.tokensUsed / agent.tokenBudget) * 100)
      : 0;

  return (
    <TooltipProvider>
      <Card
        className={cn(
          "cursor-pointer hover:shadow-md transition-shadow",
          agent.status === "error" && "border-red-500/50"
        )}
        onClick={() => onViewLogs(agent.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onViewLogs(agent.id);
        }}
      >
        <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <RoleIcon className={cn("h-4 w-4", roleColor)} />
            <span className="font-medium text-sm truncate max-w-[8rem]">{agent.name}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <StatusIndicator status={agent.status} />
            <Badge variant="secondary" className="text-xs px-1.5 py-0">
              {STATUS_LABELS[agent.status]}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="px-4 pb-4 space-y-3">
          {/* Role */}
          <p className="text-xs text-muted-foreground">{ROLE_LABELS[agent.role]}</p>

          {/* Progress */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>진행률</span>
              <span>{agent.progress}%</span>
            </div>
            <Progress value={agent.progress} className="h-1.5" />
          </div>

          {/* Current task */}
          {agent.currentTask ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="text-xs text-muted-foreground truncate">
                  ▸ {agent.currentTask}
                </p>
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">{agent.currentTask}</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <p className="text-xs text-muted-foreground italic">태스크 없음</p>
          )}

          {/* Token usage (shown on hover via tooltip) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="space-y-1">
                <Progress
                  value={tokenPercent}
                  className={cn(
                    "h-1",
                    tokenPercent >= 90
                      ? "bg-red-100 [&>div]:bg-red-500"
                      : tokenPercent >= 70
                        ? "bg-yellow-100 [&>div]:bg-yellow-500"
                        : ""
                  )}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                토큰 사용량: {agent.tokensUsed.toLocaleString()} /{" "}
                {agent.tokenBudget.toLocaleString()} ({tokenPercent}%)
              </p>
            </TooltipContent>
          </Tooltip>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
