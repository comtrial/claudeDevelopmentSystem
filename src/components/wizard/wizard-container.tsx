"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useWizardStore, selectHasUnsavedChanges } from "@/stores/wizard-store";
import type { WizardStep, PipelineModeType } from "@/types/wizard";
import type { ApiResponse } from "@/types/api";
import { WizardStepper } from "./wizard-stepper";
import { WizardActions } from "./wizard-actions";
import { StepTaskInput } from "./step-task-input";
import { StepAgentConfig } from "./step-agent-config";
import { StepModeSelect } from "./step-mode-select";

const stepComponents: Record<WizardStep, React.ComponentType> = {
  1: StepTaskInput,
  2: StepAgentConfig,
  3: StepModeSelect,
};

const stepVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -80 : 80,
    opacity: 0,
  }),
};

const MODE_TO_DB: Record<PipelineModeType, string> = {
  "auto-edit": "auto_edit",
  review: "review",
  "plan-only": "plan_only",
};

export function WizardContainer() {
  const router = useRouter();
  const currentStep = useWizardStore((s) => s.currentStep);
  const isSubmitting = useWizardStore((s) => s.isSubmitting);
  const hasUnsavedChanges = useWizardStore(selectHasUnsavedChanges);
  const setStep = useWizardStore((s) => s.setStep);
  const setSubmitting = useWizardStore((s) => s.setSubmitting);
  const reset = useWizardStore((s) => s.reset);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // beforeunload warning
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges]);

  // Reset store on unmount
  useEffect(() => {
    return () => reset();
  }, [reset]);

  const handlePrev = useCallback(() => {
    if (currentStep > 1) {
      setStep((currentStep - 1) as WizardStep);
    }
  }, [currentStep, setStep]);

  const handleNext = useCallback(() => {
    if (currentStep < 3) {
      setStep((currentStep + 1) as WizardStep);
    }
  }, [currentStep, setStep]);

  const handleStepClick = useCallback(
    (step: WizardStep) => {
      if (step < currentStep) {
        setStep(step);
      }
    },
    [currentStep, setStep]
  );

  const handleSubmit = useCallback(async () => {
    const { tasks, agents, mode, category, originalQuery, analysis, workingDir } = useWizardStore.getState();
    setSubmitError(null);

    if (tasks.length === 0) {
      setSubmitError("분석된 작업이 없습니다. 먼저 작업을 분석해주세요.");
      return;
    }

    if (category === "development" && !workingDir.trim()) {
      setSubmitError("개발 카테고리에서는 프로젝트 디렉토리를 지정해야 합니다.");
      return;
    }

    setSubmitting(true);
    try {
      // Save working_dir to recent paths
      if (workingDir.trim()) {
        const { saveRecentPath } = await import("./working-dir-input");
        saveRecentPath(workingDir.trim());
      }

      // 1. Create pipeline
      const createRes = await fetch("/api/pipelines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: tasks[0].title,
          description: tasks.map((t) => t.title).join(", "),
          original_query: originalQuery || null,
          mode: MODE_TO_DB[mode],
          config: {
            ...(analysis ? { analysis } : {}),
            category,
            ...(workingDir.trim() ? { working_dir: workingDir.trim() } : {}),
          },
          tasks: tasks.map((t) => ({
            title: t.title,
            description: t.description,
            agent_role: t.agent_role,
            order: t.order,
            estimated_complexity: t.estimated_complexity,
            acceptance_criteria: t.acceptance_criteria,
          })),
          agents: agents.map((a) => ({
            role: a.role,
            label: a.label,
            instruction: a.instruction,
            model: a.model,
            allowedTools: a.allowedTools,
            chainOrder: a.chainOrder,
            maxTurns: a.maxTurns,
          })),
        }),
      });

      const createJson: ApiResponse<{ id: string }> = await createRes.json();
      if (createJson.error || !createJson.data) {
        throw new Error(createJson.error?.message ?? "파이프라인 생성 실패");
      }

      const pipelineId = createJson.data.id;

      // 2. Execute pipeline (must await to ensure session is created before redirect)
      const execRes = await fetch(`/api/pipelines/${pipelineId}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!execRes.ok) {
        console.warn("Execute API returned:", execRes.status);
      }

      // 3. Navigate to pipeline detail page
      reset();
      router.push(`/pipelines/${pipelineId}`);
    } catch (err) {
      console.error("Pipeline creation failed:", err);
      setSubmitError(err instanceof Error ? err.message : "파이프라인 생성 중 오류가 발생했습니다.");
      setSubmitting(false);
    }
  }, [setSubmitting, reset, router]);

  const StepComponent = stepComponents[currentStep];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 sm:gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">새 파이프라인</h1>
        <WizardStepper currentStep={currentStep} onStepClick={handleStepClick} />
      </div>

      <div className="relative min-h-[320px]">
        <AnimatePresence mode="wait" custom={currentStep}>
          <motion.div
            key={currentStep}
            custom={currentStep}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.2, ease: "easeInOut" }}
          >
            <StepComponent />
          </motion.div>
        </AnimatePresence>
      </div>

      {submitError && (
        <p className="text-sm text-destructive text-center">{submitError}</p>
      )}

      <WizardActions
        currentStep={currentStep}
        isSubmitting={isSubmitting}
        onPrev={handlePrev}
        onNext={handleNext}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
