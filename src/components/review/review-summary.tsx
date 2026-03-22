"use client";

import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, Clock, AlertCircle, FileDiff } from "lucide-react";
import type { FileChange } from "./file-tree";

interface ReviewSummaryProps {
  changes: FileChange[];
}

export function ReviewSummary({ changes }: ReviewSummaryProps) {
  const total = changes.length;
  const approved = changes.filter((c) => c.review_status === "approved").length;
  const rejected = changes.filter((c) => c.review_status === "rejected").length;
  const changesRequested = changes.filter((c) => c.review_status === "changes_requested").length;
  const pending = changes.filter((c) => c.review_status === "pending").length;

  const totalAdditions = changes.reduce((acc, c) => acc + (c.additions ?? 0), 0);
  const totalDeletions = changes.reduce((acc, c) => acc + (c.deletions ?? 0), 0);

  const progressPercent = total > 0 ? Math.round((approved / total) * 100) : 0;

  return (
    <div className="space-y-3">
      {/* 진행률 바 */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>승인 진행률</span>
          <span>{progressPercent}% ({approved}/{total})</span>
        </div>
        <Progress value={progressPercent} className="h-2" />
      </div>

      {/* 상태 카운트 */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-1.5 text-sm">
          <FileDiff className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">전체</span>
          <span className="font-semibold ml-auto">{total}</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <span className="text-muted-foreground">승인</span>
          <span className="font-semibold text-green-600 dark:text-green-400 ml-auto">{approved}</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">대기</span>
          <span className="font-semibold ml-auto">{pending}</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <AlertCircle className="h-4 w-4 text-yellow-500" />
          <span className="text-muted-foreground">수정요청</span>
          <span className="font-semibold text-yellow-600 dark:text-yellow-400 ml-auto">{changesRequested}</span>
        </div>
        {rejected > 0 && (
          <div className="flex items-center gap-1.5 text-sm col-span-2">
            <XCircle className="h-4 w-4 text-red-500" />
            <span className="text-muted-foreground">거절</span>
            <span className="font-semibold text-red-600 dark:text-red-400 ml-auto">{rejected}</span>
          </div>
        )}
      </div>

      {/* 추가/삭제 라인 수 */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground border-t pt-2">
        <span className="text-green-600 dark:text-green-400 font-mono">+{totalAdditions}</span>
        <span className="text-red-600 dark:text-red-400 font-mono">-{totalDeletions}</span>
        <span className="ml-auto">총 변경 라인</span>
      </div>
    </div>
  );
}
