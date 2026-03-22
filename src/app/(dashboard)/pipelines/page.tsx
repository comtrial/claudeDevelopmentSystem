"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Play, Pause, CheckCircle2, XCircle, FileEdit, Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PipelineStatus } from "@/types/pipeline";

interface PipelineItem {
  id: string;
  title: string;
  description: string | null;
  status: PipelineStatus;
  mode: string;
  created_at: string;
  updated_at: string;
}

const STATUS_CONFIG: Record<PipelineStatus, { label: string; icon: typeof Play; className: string }> = {
  draft: { label: "초안", icon: FileEdit, className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  running: { label: "실행 중", icon: Play, className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  paused: { label: "일시정지", icon: Pause, className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  completed: { label: "완료", icon: CheckCircle2, className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  failed: { label: "실패", icon: XCircle, className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  cancelled: { label: "취소됨", icon: Ban, className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
};

export default function PipelinesPage() {
  const [pipelines, setPipelines] = useState<PipelineItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/pipelines")
      .then((r) => r.json())
      .then((res) => {
        if (res.error) {
          setError(res.error.message ?? "파이프라인 목록을 불러올 수 없습니다.");
          return;
        }
        const items = Array.isArray(res.data) ? res.data : [];
        setPipelines(items as PipelineItem[]);
      })
      .catch(() => setError("파이프라인 목록을 불러오는 데 실패했습니다."))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">파이프라인</h1>
          <p className="text-sm text-muted-foreground mt-1">AI 에이전트 파이프라인 목록</p>
        </div>
        <Button asChild className="min-h-[44px] shrink-0">
          <Link href="/pipelines/new">
            <Plus className="mr-2 h-4 w-4" />
            새 파이프라인
          </Link>
        </Button>
      </div>

      {/* 목록 */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => window.location.reload()}
          >
            재시도
          </Button>
        </div>
      ) : pipelines.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <FileEdit className="h-12 w-12 text-muted-foreground/40" strokeWidth={1} />
          <div>
            <p className="font-medium">파이프라인이 없습니다</p>
            <p className="text-sm text-muted-foreground mt-1">
              새 파이프라인을 만들어 AI 에이전트를 실행해 보세요
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/pipelines/new">새 파이프라인 만들기</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {pipelines.map((p) => {
            const config = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.draft;
            const Icon = config.icon;
            return (
              <Link
                key={p.id}
                href={`/pipelines/${p.id}`}
                className="block rounded-xl border border-border p-4 transition-colors hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[44px]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className={cn("h-5 w-5 shrink-0", config.className.includes("text-") ? "" : "")} strokeWidth={1.5} />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{p.title}</p>
                      {p.description && (
                        <p className="text-sm text-muted-foreground mt-0.5 truncate">{p.description}</p>
                      )}
                    </div>
                  </div>
                  <Badge variant="secondary" className={cn("shrink-0 text-xs", config.className)}>
                    {config.label}
                  </Badge>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
