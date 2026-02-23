"use client";

import { Bot, ClipboardList, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentConfig } from "@/types/wizard";

const ROLE_META = {
  pm: {
    icon: ClipboardList,
    colorClass: "text-agent-pm border-agent-pm/30 bg-agent-pm/5",
    iconBg: "bg-agent-pm/15",
  },
  engineer: {
    icon: Bot,
    colorClass: "text-agent-engineer border-agent-engineer/30 bg-agent-engineer/5",
    iconBg: "bg-agent-engineer/15",
  },
  reviewer: {
    icon: Search,
    colorClass: "text-agent-reviewer border-agent-reviewer/30 bg-agent-reviewer/5",
    iconBg: "bg-agent-reviewer/15",
  },
} as const;

const MODEL_OPTIONS = [
  { value: "claude-sonnet-4-5-20250514" as const, label: "Claude Sonnet 4.5" },
  { value: "claude-opus-4-0-20250514" as const, label: "Claude Opus 4" },
];

interface AgentConfigCardProps {
  config: AgentConfig;
  onChange: (updated: AgentConfig) => void;
}

export function AgentConfigCard({ config, onChange }: AgentConfigCardProps) {
  const meta = ROLE_META[config.role];
  const Icon = meta.icon;

  return (
    <div className={cn("flex flex-col gap-3 rounded-lg border p-4", meta.colorClass)}>
      <div className="flex items-center gap-2">
        <span className={cn("flex size-8 items-center justify-center rounded-md", meta.iconBg)}>
          <Icon className="size-4" />
        </span>
        <span className="text-sm font-semibold">{config.label}</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          모델
        </label>
        <select
          value={config.model}
          onChange={(e) =>
            onChange({ ...config, model: e.target.value as AgentConfig["model"] })
          }
          className="h-8 rounded-md border bg-background px-2 text-xs focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
        >
          {MODEL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          지시사항
        </label>
        <textarea
          value={config.instruction}
          onChange={(e) => onChange({ ...config, instruction: e.target.value })}
          placeholder="이 에이전트에게 특별한 지시사항을 입력하세요"
          rows={3}
          className="resize-none rounded-md border bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
        />
      </div>
    </div>
  );
}
