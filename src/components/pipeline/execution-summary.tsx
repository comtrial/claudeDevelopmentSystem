"use client";

import { useMemo, useState } from "react";
import type { ActiveLog } from "@/stores/pipeline-store";
import type { PipelineStatus } from "@/types/pipeline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, AlertTriangle, ClipboardList, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { mdComponents } from "./markdown-components";

interface ExecutionSummaryProps {
  logs: ActiveLog[];
  status: PipelineStatus;
}

interface TaskResult {
  role: string;
  message: string;
  fullOutput: string | null;
  level: "info" | "warn" | "error" | "debug" | "system";
  hasWarning: boolean;
  warningMessage: string | null;
}

// Log patterns from agent-simulator.ts
const TASK_COMPLETE_PATTERN = /^\[(\w+)\]\s*작업 완료:\s*(.+)$/;
const EMPTY_OUTPUT_TEXT = "유효한 출력 없음";
const TURN_LIMIT_PATTERN = /^\[(\w+)\]\s*턴 제한 도달/;
const CLI_ERROR_PATTERN = /^\[(\w+)\]\s*CLI 오류:/;
const PIPELINE_ERROR_PATTERN = /파이프라인 실행 중 오류:/;

function extractResults(logs: ActiveLog[]): {
  taskResults: TaskResult[];
  warnings: string[];
  errors: string[];
} {
  const taskResults: TaskResult[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  const turnLimitRoles = new Set<string>();

  for (const log of logs) {
    // Detect turn limit warnings
    const turnMatch = log.message.match(TURN_LIMIT_PATTERN);
    if (turnMatch) {
      turnLimitRoles.add(turnMatch[1]);
      warnings.push(`[${turnMatch[1]}] 턴 제한 도달 — 부분 결과가 포함될 수 있습니다.`);
    }

    // Detect CLI errors
    const cliMatch = log.message.match(CLI_ERROR_PATTERN);
    if (cliMatch) {
      errors.push(log.message);
    }

    // Detect pipeline-level errors
    if (PIPELINE_ERROR_PATTERN.test(log.message)) {
      errors.push(log.message);
    }

    // Extract task completion results
    const taskMatch = log.message.match(TASK_COMPLETE_PATTERN);
    if (taskMatch) {
      const role = taskMatch[1];
      const resultText = taskMatch[2];
      const fullOutput = (log.metadata as Record<string, unknown>)?.full_output as string | undefined;

      taskResults.push({
        role,
        message: resultText,
        fullOutput: fullOutput ?? null,
        level: log.level,
        hasWarning: resultText === EMPTY_OUTPUT_TEXT || turnLimitRoles.has(role),
        warningMessage: resultText === EMPTY_OUTPUT_TEXT
          ? "유효한 출력 없음"
          : turnLimitRoles.has(role)
          ? "턴 제한 도달 — 부분 결과 포함"
          : null,
      });
    }

    // Collect warn-level logs not already captured
    if (log.level === "warn" && !turnMatch && !taskMatch) {
      warnings.push(log.message);
    }

    // Collect error-level logs not already captured
    if (log.level === "error" && !cliMatch && !PIPELINE_ERROR_PATTERN.test(log.message)) {
      errors.push(log.message);
    }
  }

  return { taskResults, warnings, errors };
}

function TaskResultItem({ result }: { result: TaskResult }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const displayText = isExpanded && result.fullOutput ? result.fullOutput : result.message;

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-muted/40 transition-colors cursor-pointer"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <Badge variant="outline" className="shrink-0 text-[10px] uppercase font-semibold">
          {result.role}
        </Badge>
        {!isExpanded && (
          <span className="text-sm truncate text-muted-foreground">
            {result.message.length > 80 ? result.message.slice(0, 80) + "..." : result.message}
          </span>
        )}
        {result.hasWarning && (
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-yellow-500 ml-auto" />
        )}
      </button>
      {isExpanded && (
        <div className="px-3 pb-3 border-t bg-muted/10">
          <div className="pt-2">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {displayText}
            </ReactMarkdown>
          </div>
          {result.warningMessage && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-yellow-600 dark:text-yellow-400">
              <AlertTriangle className="h-3 w-3" />
              {result.warningMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ExecutionSummary({ logs, status }: ExecutionSummaryProps) {
  const { taskResults, warnings, errors } = useMemo(() => extractResults(logs), [logs]);

  // Only show for completed or failed pipelines
  if (status !== "completed" && status !== "failed") return null;
  if (taskResults.length === 0 && warnings.length === 0 && errors.length === 0) return null;

  const attentionItems = [
    ...errors.map((e) => ({ text: e, type: "error" as const })),
    ...warnings.slice(0, 5).map((w) => ({ text: w, type: "warn" as const })),
  ];

  const warningTaskCount = taskResults.filter((r) => r.hasWarning).length;
  const hasAttention = attentionItems.length > 0 || warningTaskCount > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardList className="h-4 w-4" />
          실행 결과 요약
          {status === "failed" && (
            <Badge variant="destructive" className="text-[10px]">실패</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Task results */}
        {taskResults.length > 0 && (
          <div className="space-y-2">
            {taskResults.map((result, i) => (
              <TaskResultItem key={`${result.role}-${i}`} result={result} />
            ))}
          </div>
        )}

        {/* Attention items */}
        {hasAttention && (
          <div className="border rounded-lg p-3 bg-yellow-500/5">
            <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              확인 필요 사항
            </h3>
            <ul className="space-y-1">
              {warningTaskCount > 0 && (
                <li className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <span className="shrink-0 mt-0.5">•</span>
                  턴 제한 도달 또는 빈 결과 작업 {warningTaskCount}건
                </li>
              )}
              {attentionItems.map((item, i) => (
                <li
                  key={i}
                  className={cn(
                    "text-xs flex items-start gap-1.5",
                    item.type === "error" ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
                  )}
                >
                  <span className="shrink-0 mt-0.5">•</span>
                  <span className="break-words min-w-0">{item.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Follow-up guide */}
        <div className="border rounded-lg p-3 bg-blue-500/5">
          <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-1.5">
            <Lightbulb className="h-4 w-4 text-blue-500" />
            후속 질의 가이드
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            위 결과를 확인하고, 추가 수정이나 보완이 필요하면 아래 후속 질의를 사용하세요.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            예: &quot;리뷰 결과 반영해서 코드 수정해줘&quot;, &quot;테스트 실패 원인 분석해줘&quot;
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
