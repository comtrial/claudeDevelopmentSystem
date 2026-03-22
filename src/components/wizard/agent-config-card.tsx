"use client";

import { useState } from "react";
import { Bot, ClipboardList, Search, Plus, X, ChevronDown, ChevronUp } from "lucide-react";
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
  { value: "claude-opus-4-6" as const, label: "Claude Opus 4.6" },
  { value: "claude-sonnet-4-5-20250514" as const, label: "Claude Sonnet 4.5" },
];

const TOOL_PRESETS = [
  { value: "mcp__claude_ai_Notion", label: "Notion", description: "Notion 워크스페이스 접근" },
  { value: "Bash", label: "Bash", description: "터미널 명령어 실행" },
  { value: "Read", label: "파일 읽기", description: "파일 시스템 읽기" },
  { value: "Write", label: "파일 쓰기", description: "파일 생성/수정" },
  { value: "Edit", label: "파일 편집", description: "파일 부분 수정" },
  { value: "WebFetch", label: "웹 페치", description: "URL 내용 가져오기" },
  { value: "WebSearch", label: "웹 검색", description: "웹 검색" },
] as const;

interface AgentConfigCardProps {
  config: AgentConfig;
  onChange: (updated: AgentConfig) => void;
}

export function AgentConfigCard({ config, onChange }: AgentConfigCardProps) {
  const meta = ROLE_META[config.role];
  const Icon = meta.icon;
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const [customTool, setCustomTool] = useState("");

  const toggleTool = (toolValue: string) => {
    const current = config.allowedTools ?? [];
    const next = current.includes(toolValue)
      ? current.filter((t) => t !== toolValue)
      : [...current, toolValue];
    onChange({ ...config, allowedTools: next });
  };

  const addCustomTool = () => {
    const trimmed = customTool.trim();
    if (trimmed && !(config.allowedTools ?? []).includes(trimmed)) {
      onChange({ ...config, allowedTools: [...(config.allowedTools ?? []), trimmed] });
      setCustomTool("");
    }
  };

  const removeCustomTool = (tool: string) => {
    onChange({ ...config, allowedTools: (config.allowedTools ?? []).filter((t) => t !== tool) });
  };

  const presetValues = new Set<string>(TOOL_PRESETS.map((p) => p.value));
  const customTools = (config.allowedTools ?? []).filter((t) => !presetValues.has(t));

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
          className="h-10 rounded-md border bg-background px-2 text-base sm:h-8 sm:text-xs focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
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
          className="resize-none rounded-md border bg-background px-3 py-2 text-base sm:text-xs placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
        />
      </div>

      {/* Allowed Tools Section */}
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => setToolsExpanded(!toolsExpanded)}
          className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
        >
          허용 도구
          {(config.allowedTools ?? []).length > 0 && (
            <span className="rounded-full bg-foreground/10 px-1.5 text-[10px] font-semibold">
              {(config.allowedTools ?? []).length}
            </span>
          )}
          {toolsExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
        </button>

        {toolsExpanded && (
          <div className="flex flex-col gap-2 rounded-md border bg-background p-2">
            <p className="text-[10px] text-muted-foreground">
              비대화 모드에서 자동 승인할 도구를 선택하세요. 미선택 시 CLI 기본 동작.
            </p>

            {/* Preset tools */}
            <div className="flex flex-col gap-1">
              {TOOL_PRESETS.map((preset) => (
                <label key={preset.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(config.allowedTools ?? []).includes(preset.value)}
                    onChange={() => toggleTool(preset.value)}
                    className="size-3.5 rounded border accent-current"
                  />
                  <span className="text-xs font-medium">{preset.label}</span>
                  <span className="text-[10px] text-muted-foreground">{preset.description}</span>
                </label>
              ))}
            </div>

            {/* Custom tools */}
            {customTools.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {customTools.map((tool) => (
                  <span
                    key={tool}
                    className="inline-flex items-center gap-1 rounded-full bg-foreground/10 px-2 py-0.5 text-[10px]"
                  >
                    {tool}
                    <button type="button" onClick={() => removeCustomTool(tool)}>
                      <X className="size-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Custom tool input */}
            <div className="flex gap-1">
              <input
                type="text"
                value={customTool}
                onChange={(e) => setCustomTool(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomTool();
                  }
                }}
                placeholder="커스텀 도구 이름"
                className="flex-1 rounded-md border bg-background px-2 py-1 text-[11px] placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/30"
              />
              <button
                type="button"
                onClick={addCustomTool}
                disabled={!customTool.trim()}
                className="flex items-center gap-0.5 rounded-md border px-1.5 py-1 text-[10px] hover:bg-foreground/5 disabled:opacity-40"
              >
                <Plus className="size-3" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
