"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { usePipelines } from "@/hooks/use-pipelines";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/dashboard/empty-state";
import { PipelineList } from "@/components/dashboard/pipeline-list";
import { RecentHistory } from "@/components/dashboard/recent-history";

export function DashboardContent() {
  // TODO: Replace with actual userId from auth context when available
  const { pipelines, isLoading, error, refetch } = usePipelines({
    userId: "mock-user",
  });

  if (isLoading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={refetch} />;
  if (pipelines.length === 0) return <EmptyState />;

  return (
    <div className="space-y-6 sm:space-y-8">
      <PipelineList pipelines={pipelines} />
      <RecentHistory />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-8 w-32" />
      </div>

      {/* Card grid skeleton */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-4 rounded-xl border border-border p-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <div className="flex gap-3">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-14" />
            </div>
            <Skeleton className="h-1.5 w-full rounded-full" />
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>

      {/* History skeleton */}
      <div className="space-y-3">
        <Skeleton className="h-px w-full" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <Skeleton className="size-4 rounded-full" />
              <Skeleton className="h-4 w-40" />
            </div>
            <Skeleton className="h-3 w-14" />
          </div>
        ))}
      </div>
    </div>
  );
}

interface DashboardErrorProps {
  error: string;
  onRetry: () => void;
}

function DashboardError({ error, onRetry }: DashboardErrorProps) {
  return (
    <div
      role="alert"
      className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-lg bg-destructive/10 p-6 text-center"
    >
      <AlertTriangle
        className="size-8 text-destructive"
        strokeWidth={1.5}
      />
      <p className="text-sm font-medium text-destructive">
        파이프라인을 불러오지 못했습니다
      </p>
      <p className="text-xs text-muted-foreground">{error}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="size-4" strokeWidth={1.5} />
        재시도
      </Button>
    </div>
  );
}
