"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { useState } from "react";
import { cn } from "@/lib/utils";

export interface SessionLifetimeGaugeProps {
  sessionId: string;
  tokenUsed: number;
  tokenLimit: number;
}

function getColor(pct: number): string {
  if (pct >= 90) return "text-red-600";
  if (pct >= 80) return "text-orange-500";
  if (pct >= 60) return "text-yellow-500";
  return "text-green-600";
}

function getBarColor(pct: number): string {
  if (pct >= 90) return "[&>div]:bg-red-500";
  if (pct >= 80) return "[&>div]:bg-orange-500";
  if (pct >= 60) return "[&>div]:bg-yellow-500";
  return "[&>div]:bg-green-500";
}

export function SessionLifetimeGauge({
  tokenUsed,
  tokenLimit,
}: SessionLifetimeGaugeProps) {
  const percentage = tokenLimit > 0 ? Math.min(Math.round((tokenUsed / tokenLimit) * 100), 100) : 0;
  const [showModal, setShowModal] = useState(false);

  // Track previous thresholds to avoid repeated toasts/modals
  const toastFiredRef = useRef(false);
  const modalFiredRef = useRef(false);

  useEffect(() => {
    if (percentage >= 90 && !modalFiredRef.current) {
      modalFiredRef.current = true;
      // Defer state update to avoid synchronous setState inside effect
      const id = setTimeout(() => setShowModal(true), 0);
      return () => clearTimeout(id);
    } else if (percentage >= 80 && percentage < 90 && !toastFiredRef.current) {
      toastFiredRef.current = true;
      toast.warning("토큰 사용량 경고", {
        description: `세션 토큰이 ${percentage}% 사용됐습니다. 곧 한도에 도달합니다.`,
        duration: 8000,
      });
    }
  }, [percentage]);

  const colorClass = getColor(percentage);
  const barColorClass = getBarColor(percentage);

  return (
    <>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">세션 토큰</span>
          <span className={cn("font-medium tabular-nums", colorClass)}>
            {percentage}% — {tokenUsed.toLocaleString()} / {tokenLimit.toLocaleString()} tokens
          </span>
        </div>
        <Progress
          value={percentage}
          className={cn("h-1.5", barColorClass)}
        />
        {percentage >= 60 && percentage < 80 && (
          <p className="text-xs text-yellow-600">토큰 사용량이 높습니다.</p>
        )}
        {percentage >= 80 && percentage < 90 && (
          <p className="text-xs text-orange-500 font-medium">
            ⚠ 토큰 한도에 가까워지고 있습니다.
          </p>
        )}
      </div>

      {/* Critical token modal (≥90%) */}
      <AlertDialog open={showModal} onOpenChange={setShowModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>토큰 한도 임박</AlertDialogTitle>
            <AlertDialogDescription>
              세션 토큰 사용량이 <strong>{percentage}%</strong>에 달했습니다
              ({tokenUsed.toLocaleString()} / {tokenLimit.toLocaleString()} tokens).
              파이프라인이 곧 중단될 수 있습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowModal(false)}>
              확인
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
