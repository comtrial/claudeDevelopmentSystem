"use client";

import { useState } from "react";
import { toast } from "sonner";
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
import { Button } from "@/components/ui/button";
import { Pause, Play, XCircle, Loader2 } from "lucide-react";
import type { PipelineStatus } from "@/types/pipeline";

interface PipelineControlsProps {
  pipelineId: string;
  status: PipelineStatus;
  onStatusChange?: (newStatus: PipelineStatus) => void;
}

async function callAction(pipelineId: string, action: "pause" | "resume" | "cancel") {
  const res = await fetch(`/api/pipelines/${pipelineId}/${action}`, {
    method: "POST",
  });
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `${action} 실패`);
  }
  return json.data as { status: PipelineStatus };
}

export function PipelineControls({
  pipelineId,
  status,
  onStatusChange,
}: PipelineControlsProps) {
  const [loading, setLoading] = useState<"pause" | "resume" | "cancel" | null>(null);

  const isRunning = status === "running";
  const isPaused = status === "paused";
  const isTerminal = status === "completed" || status === "failed" || status === "cancelled";

  async function handleAction(action: "pause" | "resume" | "cancel") {
    setLoading(action);
    try {
      const result = await callAction(pipelineId, action);
      onStatusChange?.(result.status);

      const messages: Record<typeof action, string> = {
        pause: "파이프라인이 일시정지됐습니다.",
        resume: "파이프라인이 재개됐습니다.",
        cancel: "파이프라인이 취소됐습니다.",
      };
      toast.success(messages[action]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "알 수 없는 오류";
      toast.error(`오류: ${msg}`);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
      {/* Pause button — only when running */}
      <Button
        variant="outline"
        size="sm"
        disabled={!isRunning || loading !== null || isTerminal}
        onClick={() => handleAction("pause")}
      >
        {loading === "pause" ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Pause className="mr-2 h-4 w-4" />
        )}
        일시정지
      </Button>

      {/* Resume button — only when paused */}
      <Button
        variant="outline"
        size="sm"
        disabled={!isPaused || loading !== null || isTerminal}
        onClick={() => handleAction("resume")}
      >
        {loading === "resume" ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Play className="mr-2 h-4 w-4" />
        )}
        재개
      </Button>

      {/* Cancel button — running or paused, with confirmation */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="destructive"
            size="sm"
            disabled={(!isRunning && !isPaused) || loading !== null || isTerminal}
          >
            {loading === "cancel" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <XCircle className="mr-2 h-4 w-4" />
            )}
            취소
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>파이프라인 취소</AlertDialogTitle>
            <AlertDialogDescription>
              정말로 이 파이프라인을 취소하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>돌아가기</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleAction("cancel")}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              취소 확인
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
