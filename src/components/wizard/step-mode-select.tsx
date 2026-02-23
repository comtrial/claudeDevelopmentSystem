"use client";

import { Zap, Eye, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useWizardStore } from "@/stores/wizard-store";
import type { PipelineModeType } from "@/types/wizard";
import { ModeOptionCard } from "./mode-option-card";
import { ExecutionSummary } from "./execution-summary";

const MODE_OPTIONS: {
  value: PipelineModeType;
  icon: typeof Zap;
  title: string;
  description: string;
  badge?: string;
}[] = [
  {
    value: "auto-edit",
    icon: Zap,
    title: "자동 편집",
    description: "에이전트가 코드를 직접 수정합니다. 빠르지만 검토 없이 바로 적용됩니다.",
  },
  {
    value: "review",
    icon: Eye,
    title: "리뷰 모드",
    description: "변경사항을 검토 후 적용합니다. 안전하고 권장되는 모드입니다.",
    badge: "추천",
  },
  {
    value: "plan-only",
    icon: FileText,
    title: "계획만",
    description: "실행 계획만 생성합니다. 코드 변경 없이 계획을 먼저 확인하세요.",
  },
];

export function StepModeSelect() {
  const mode = useWizardStore((s) => s.mode);
  const setMode = useWizardStore((s) => s.setMode);

  return (
    <Card>
      <CardHeader>
        <CardTitle>실행 모드</CardTitle>
        <CardDescription>
          파이프라인의 실행 모드를 선택하세요.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {MODE_OPTIONS.map((opt) => (
            <ModeOptionCard
              key={opt.value}
              icon={opt.icon}
              title={opt.title}
              description={opt.description}
              badge={opt.badge}
              selected={mode === opt.value}
              onClick={() => setMode(opt.value)}
            />
          ))}
        </div>

        <ExecutionSummary />
      </CardContent>
    </Card>
  );
}
