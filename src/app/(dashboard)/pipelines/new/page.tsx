"use client";

import { Suspense } from "react";
import { WizardContainer } from "@/components/wizard/wizard-container";

export default function NewPipelinePage() {
  return (
    <div className="container py-6">
      <Suspense fallback={<WizardSkeleton />}>
        <WizardContainer />
      </Suspense>
    </div>
  );
}

function WizardSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="h-8 w-40 animate-pulse rounded bg-muted" />
        <div className="h-8 w-60 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-[320px] animate-pulse rounded-xl border bg-muted" />
      <div className="flex justify-between border-t pt-4">
        <div className="h-9 w-20 animate-pulse rounded bg-muted" />
        <div className="h-9 w-20 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
