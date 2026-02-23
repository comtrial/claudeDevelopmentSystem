"use client";

import { useRouter } from "next/navigation";
import { Music, FileSearch, Search, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TemplateCard } from "@/components/dashboard/template-card";
import type { PipelineMode } from "@/types/pipeline";
import type { LucideIcon } from "lucide-react";

interface Template {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  agents: string;
  mode: PipelineMode;
}

const templates: Template[] = [
  {
    id: "code-review",
    title: "코드 리뷰",
    description: "PR 단위 코드 리뷰 자동화",
    icon: FileSearch,
    agents: "PM \u2192 Engineer \u2192 Reviewer",
    mode: "review",
  },
  {
    id: "analysis",
    title: "분석 & 계획",
    description: "코드베이스 분석 후 실행 계획 수립",
    icon: Search,
    agents: "PM \u2192 Engineer",
    mode: "plan_only",
  },
  {
    id: "refactoring",
    title: "리팩토링 & 개선",
    description: "기존 코드 자동 리팩토링",
    icon: RefreshCw,
    agents: "Engineer \u2192 Reviewer",
    mode: "auto_edit",
  },
];

export function EmptyState() {
  const router = useRouter();

  return (
    <section
      aria-label="시작 안내"
      className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-6 text-center"
    >
      <Music
        className="mb-6 size-12 text-muted-foreground"
        strokeWidth={1.5}
      />

      <h2 className="mb-2 text-2xl font-semibold tracking-tight">
        AI 에이전트 오케스트레이터
      </h2>

      <p className="mb-8 max-w-md text-base text-muted-foreground">
        AI 에이전트 팀을 구성하고, 파이프라인으로 작업을 자동화하세요.
        결과를 리뷰하고 승인만 하면 됩니다.
      </p>

      <Button
        size="lg"
        className="mb-8 w-full max-w-xs"
        onClick={() => router.push("/pipelines/new")}
      >
        첫 파이프라인 만들기
      </Button>

      <p className="mb-4 text-sm text-muted-foreground">
        또는 템플릿으로 시작:
      </p>

      <div className="grid w-full max-w-lg grid-cols-1 gap-4 sm:grid-cols-3">
        {templates.map((template) => (
          <TemplateCard key={template.id} {...template} />
        ))}
      </div>
    </section>
  );
}
