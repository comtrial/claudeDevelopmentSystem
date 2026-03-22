"use client";

import { Wand2 } from "lucide-react";

interface TaskEmptyStateProps {
  hasInput: boolean;
  needsWorkingDir: boolean;
}

export function TaskEmptyState({ hasInput, needsWorkingDir }: TaskEmptyStateProps) {
  if (!hasInput) {
    return (
      <div className="flex min-h-[140px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/20 px-6 py-8 text-center">
        <div className="flex size-10 items-center justify-center rounded-full bg-muted">
          <Wand2 className="size-5 text-muted-foreground" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-muted-foreground">
            작업을 자연어로 입력하고 분석하세요
          </p>
          <p className="text-xs text-muted-foreground/70">
            AI가 자동으로 Task 카드를 생성합니다
          </p>
        </div>
      </div>
    );
  }

  if (needsWorkingDir) {
    return (
      <div className="flex min-h-[100px] items-center justify-center rounded-xl border border-dashed border-amber-300/50 bg-amber-50/30 px-6 py-6 text-center dark:border-amber-500/30 dark:bg-amber-950/20">
        <p className="text-sm text-amber-700 dark:text-amber-400">
          프로젝트 디렉토리를 지정하고{" "}
          <span className="font-medium">작업 분석</span> 버튼을 눌러주세요
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100px] items-center justify-center rounded-xl border border-dashed px-6 py-6">
      <p className="text-sm text-muted-foreground">
        <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs">작업 분석</kbd>{" "}
        버튼을 클릭하세요
      </p>
    </div>
  );
}
