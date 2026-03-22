"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PipelineCard } from "@/components/dashboard/pipeline-card";
import type { PipelineSummary } from "@/types/pipeline-summary";

const INITIAL_DISPLAY = 4;

interface PipelineListProps {
  pipelines: PipelineSummary[];
}

export function PipelineList({ pipelines }: PipelineListProps) {
  const router = useRouter();
  const [showAll, setShowAll] = useState(false);

  const displayed = showAll ? pipelines : pipelines.slice(0, INITIAL_DISPLAY);
  const hasMore = pipelines.length > INITIAL_DISPLAY;

  const handleCardClick = useCallback(
    (id: string) => {
      router.push(`/pipelines/${id}`);
    },
    [router]
  );

  return (
    <section aria-label="활성 파이프라인 목록">
      <div className="mb-4 flex items-center justify-between sm:mb-6">
        <h2 className="text-base font-semibold sm:text-lg">
          활성 파이프라인 {pipelines.length}개
        </h2>
        <Button
          size="sm"
          className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
          onClick={() => router.push("/pipelines/new")}
        >
          <Plus className="size-4" strokeWidth={1.5} />
          새 파이프라인
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {displayed.map((pipeline) => (
          <PipelineCard
            key={pipeline.id}
            pipeline={pipeline}
            onClick={handleCardClick}
          />
        ))}
      </div>

      {hasMore && !showAll && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(true)}
            className="text-muted-foreground"
          >
            {pipelines.length - INITIAL_DISPLAY}개 더보기
          </Button>
        </div>
      )}
    </section>
  );
}
