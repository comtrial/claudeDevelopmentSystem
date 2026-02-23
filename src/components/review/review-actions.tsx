"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CheckCircle2, XCircle, MessageSquareDiff } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReviewActionsProps {
  pipelineId: string;
  changeId: string;
  currentStatus: string;
  onStatusChange?: (newStatus: string) => void;
}

export function ReviewActions({ pipelineId, changeId, currentStatus, onStatusChange }: ReviewActionsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [changesComment, setChangesComment] = useState("");
  const [showChangesInput, setShowChangesInput] = useState(false);

  async function callReviewApi(action: string, comment?: string) {
    setLoading(action);
    setError(null);
    try {
      const res = await fetch(
        `/api/pipelines/${pipelineId}/changes/${changeId}/review`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, comment }),
        }
      );
      const json = await res.json();
      if (json.error) {
        setError(json.error.message ?? "요청 실패");
        return;
      }
      const statusMap: Record<string, string> = {
        approve: "approved",
        request_changes: "changes_requested",
        reject: "rejected",
      };
      onStatusChange?.(statusMap[action] ?? action);
    } catch {
      setError("서버 오류가 발생했습니다.");
    } finally {
      setLoading(null);
    }
  }

  const isApproved = currentStatus === "approved";
  const isRejected = currentStatus === "rejected";
  const isChangesRequested = currentStatus === "changes_requested";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {/* 승인 버튼 */}
        <Button
          size="sm"
          variant={isApproved ? "default" : "outline"}
          className={cn(
            "gap-1.5",
            isApproved
              ? "bg-green-600 hover:bg-green-700 text-white border-transparent"
              : "border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30"
          )}
          disabled={!!loading || isApproved}
          onClick={() => callReviewApi("approve")}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          {loading === "approve" ? "처리 중..." : isApproved ? "승인됨" : "승인"}
        </Button>

        {/* 수정 요청 버튼 */}
        <Button
          size="sm"
          variant={isChangesRequested ? "default" : "outline"}
          className={cn(
            "gap-1.5",
            isChangesRequested
              ? "bg-yellow-600 hover:bg-yellow-700 text-white border-transparent"
              : "border-yellow-500 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-950/30"
          )}
          disabled={!!loading || isChangesRequested}
          onClick={() => setShowChangesInput((v) => !v)}
        >
          <MessageSquareDiff className="h-3.5 w-3.5" />
          {isChangesRequested ? "수정 요청됨" : "수정 요청"}
        </Button>

        {/* 거절 버튼 (AlertDialog 확인) */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              size="sm"
              variant={isRejected ? "destructive" : "outline"}
              className={cn(
                "gap-1.5",
                !isRejected && "border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
              )}
              disabled={!!loading || isRejected}
            >
              <XCircle className="h-3.5 w-3.5" />
              {loading === "reject" ? "처리 중..." : isRejected ? "거절됨" : "거절"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>변경 사항을 거절하시겠습니까?</AlertDialogTitle>
              <AlertDialogDescription>
                이 변경 사항을 거절하면 파이프라인이 실패 상태로 표시될 수 있습니다.
                이 작업은 되돌릴 수 없습니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>취소</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => callReviewApi("reject")}
              >
                거절
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* 수정 요청 댓글 입력 */}
      {showChangesInput && (
        <div className="space-y-2 pt-1">
          <Textarea
            value={changesComment}
            onChange={(e) => setChangesComment(e.target.value)}
            placeholder="수정이 필요한 내용을 설명해 주세요..."
            className="min-h-[80px] text-sm resize-none"
          />
          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowChangesInput(false);
                setChangesComment("");
              }}
            >
              취소
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-yellow-500 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-950/30"
              disabled={!changesComment.trim() || !!loading}
              onClick={() => {
                callReviewApi("request_changes", changesComment);
                setShowChangesInput(false);
                setChangesComment("");
              }}
            >
              수정 요청 제출
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
