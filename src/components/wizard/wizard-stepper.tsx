"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { WIZARD_STEPS, type WizardStep } from "@/types/wizard";

interface WizardStepperProps {
  currentStep: WizardStep;
  onStepClick?: (step: WizardStep) => void;
}

export function WizardStepper({ currentStep, onStepClick }: WizardStepperProps) {
  return (
    <nav aria-label="진행 단계" className="flex items-center gap-2">
      {WIZARD_STEPS.map(({ step, label }, index) => {
        const isCompleted = step < currentStep;
        const isCurrent = step === currentStep;
        const isClickable = isCompleted && onStepClick;

        return (
          <div key={step} className="flex items-center gap-2">
            {index > 0 && (
              <div
                className={cn(
                  "h-px w-8 sm:w-12 transition-colors",
                  isCompleted ? "bg-primary" : "bg-border"
                )}
              />
            )}
            <button
              type="button"
              disabled={!isClickable}
              onClick={() => isClickable && onStepClick(step)}
              className={cn(
                "flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-all",
                "disabled:cursor-default",
                isCurrent && "bg-primary text-primary-foreground shadow-sm",
                isCompleted && "bg-primary/10 text-primary hover:bg-primary/20",
                !isCurrent && !isCompleted && "text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                  isCurrent && "bg-primary-foreground/20",
                  isCompleted && "bg-primary text-primary-foreground",
                  !isCurrent && !isCompleted && "border border-muted-foreground/30"
                )}
              >
                {isCompleted ? <Check className="size-3.5" /> : step}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </button>
          </div>
        );
      })}
    </nav>
  );
}
