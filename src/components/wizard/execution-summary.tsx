"use client";

import { useWizardStore } from "@/stores/wizard-store";
import type { PipelineModeType } from "@/types/wizard";

const MODE_LABELS: Record<PipelineModeType, string> = {
  "auto-edit": "자동 편집",
  review: "리뷰 모드",
  "plan-only": "계획만",
};

export function ExecutionSummary() {
  const tasks = useWizardStore((s) => s.tasks);
  const agents = useWizardStore((s) => s.agents);
  const mode = useWizardStore((s) => s.mode);

  const agentSummary = agents
    .map((a) => `${a.label}(${a.model.includes("opus") ? "Opus" : "Sonnet"})`)
    .join(", ");

  return (
    <div className="rounded-lg border bg-surface/50 p-3 sm:p-4">
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        실행 요약
      </h4>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm sm:gap-x-4">
        <dt className="text-muted-foreground">작업 수</dt>
        <dd className="font-medium">{tasks.length}개</dd>

        <dt className="text-muted-foreground">에이전트</dt>
        <dd className="font-medium">{agentSummary || "미설정"}</dd>

        <dt className="text-muted-foreground">실행 모드</dt>
        <dd className="font-medium">{MODE_LABELS[mode]}</dd>
      </dl>
    </div>
  );
}
