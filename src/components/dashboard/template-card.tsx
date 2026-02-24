"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import type { LucideIcon } from "lucide-react";
import type { PipelineMode } from "@/types/pipeline";

interface TemplateCardProps {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  agents: string;
  mode: PipelineMode;
}

export function TemplateCard({
  id,
  title,
  description,
  icon: Icon,
  agents,
}: TemplateCardProps) {
  const router = useRouter();

  const handleSelect = useCallback(() => {
    router.push(`/pipelines/new?template=${id}`);
  }, [router, id]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleSelect();
      }
    },
    [handleSelect]
  );

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${title} 템플릿으로 시작`}
      onClick={handleSelect}
      onKeyDown={handleKeyDown}
      className="group relative cursor-pointer rounded-lg border border-border bg-card p-4 transition-all duration-150 hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
    >
      <Icon
        className="mb-3 size-6 text-muted-foreground transition-colors group-hover:text-primary"
        strokeWidth={1.5}
      />
      <p className="mb-1 text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
      <p className="mt-2 text-xs text-muted-foreground">{agents}</p>
    </div>
  );
}
