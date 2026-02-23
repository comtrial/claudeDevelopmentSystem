"use client";

import { ArrowLeft, ArrowRight, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WizardStep } from "@/types/wizard";

interface WizardActionsProps {
  currentStep: WizardStep;
  isSubmitting: boolean;
  onPrev: () => void;
  onNext: () => void;
  onSubmit: () => void;
}

export function WizardActions({
  currentStep,
  isSubmitting,
  onPrev,
  onNext,
  onSubmit,
}: WizardActionsProps) {
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === 3;

  return (
    <div className="flex items-center justify-between border-t pt-4">
      <div>
        {!isFirstStep && (
          <Button variant="ghost" onClick={onPrev} disabled={isSubmitting}>
            <ArrowLeft />
            이전
          </Button>
        )}
      </div>
      <div>
        {isLastStep ? (
          <Button onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                생성 중...
              </span>
            ) : (
              <>
                <Rocket />
                파이프라인 생성
              </>
            )}
          </Button>
        ) : (
          <Button onClick={onNext}>
            다음
            <ArrowRight />
          </Button>
        )}
      </div>
    </div>
  );
}
