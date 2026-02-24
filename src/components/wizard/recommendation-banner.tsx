"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { useWizardStore } from "@/stores/wizard-store";
import type { ApiResponse } from "@/types/api";

const DEFAULT_AGENTS = [
  { role: "pm", label: "PM", instruction: "", model: "claude-opus-4-6" },
  { role: "engineer", label: "Engineer", instruction: "", model: "claude-opus-4-6" },
  { role: "reviewer", label: "Reviewer", instruction: "", model: "claude-opus-4-6" },
];

export function RecommendationBanner() {
  const router = useRouter();
  const recommendation = useWizardStore((s) => s.recommendation);
  const tasks = useWizardStore((s) => s.tasks);
  const setSubmitting = useWizardStore((s) => s.setSubmitting);
  const isSubmitting = useWizardStore((s) => s.isSubmitting);
  const reset = useWizardStore((s) => s.reset);
  const [open, setOpen] = useState(false);

  if (!recommendation || recommendation.confidence < 0.7 || !recommendation.preset_id) {
    return null;
  }

  const handleFastPath = async () => {
    if (tasks.length === 0) return;

    setSubmitting(true);
    try {
      // 1. Create pipeline with default agents + review mode
      const createRes = await fetch("/api/pipelines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: tasks[0].title,
          description: tasks.map((t) => t.title).join(", "),
          mode: "review",
          preset_template_id: recommendation.preset_id,
          tasks: tasks.map((t) => ({
            title: t.title,
            description: t.description,
            agent_role: t.agent_role,
            order: t.order,
          })),
          agents: DEFAULT_AGENTS,
        }),
      });

      const createJson: ApiResponse<{ id: string }> = await createRes.json();
      if (createJson.error || !createJson.data) {
        throw new Error(createJson.error?.message ?? "파이프라인 생성 실패");
      }

      const pipelineId = createJson.data.id;

      // 2. Execute
      await fetch(`/api/pipelines/${pipelineId}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      // 3. Navigate
      reset();
      router.push(`/pipelines/${pipelineId}/monitor`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "파이프라인 생성 중 오류가 발생했습니다.";
      toast.error(message);
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-agent-pm/30 bg-agent-pm/5 px-3 py-3 sm:px-4">
      <Sparkles className="size-4 shrink-0 text-agent-pm" />
      <p className="min-w-0 flex-1 text-sm">
        추천 프리셋:{" "}
        <span className="font-medium">{recommendation.preset_name}</span>
        <span className="ml-1 text-muted-foreground">
          ({Math.round(recommendation.confidence * 100)}% 일치)
        </span>
      </p>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="sm" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin" />
                생성 중...
              </>
            ) : (
              "바로 적용"
            )}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>추천 프리셋 적용</AlertDialogTitle>
            <AlertDialogDescription>
              추천 프리셋 &apos;{recommendation.preset_name}&apos;을 적용하시겠습니까?
              기본 에이전트 설정과 리뷰 모드로 즉시 실행됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                setOpen(false);
                handleFastPath();
              }}
            >
              적용 및 실행
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
