"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelativeTime } from "@/lib/utils/format-time";
import type { PipelineHistory } from "@/types/pipeline";

interface RecentHistoryProps {
  className?: string;
}

type FetchState = "idle" | "loading" | "loaded" | "error";

export function RecentHistory({ className }: RecentHistoryProps) {
  const router = useRouter();
  const [items, setItems] = useState<PipelineHistory[]>([]);
  const [state, setState] = useState<FetchState>("idle");

  const fetchHistory = useCallback(async () => {
    setState("loading");
    try {
      const res = await fetch("/api/history?limit=5");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setItems(json.data ?? []);
      setState("loaded");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return (
    <section aria-label="최근 완료 히스토리" className={cn("space-y-4", className)}>
      <Separator />

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          최근 완료
        </h3>
        <Link
          href="/history"
          className="text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          전체 보기 &rarr;
        </Link>
      </div>

      {state === "loading" && <HistorySkeleton />}

      {state === "loaded" && items.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          완료된 파이프라인이 없습니다
        </p>
      )}

      {state === "error" && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          히스토리를 불러오지 못했습니다
        </p>
      )}

      {state === "loaded" && items.length > 0 && (
        <ul role="list">
          {items.map((item) => {
            const isSuccess =
              item.status === "completed";

            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => router.push(`/history/${item.pipeline_id}`)}
                  className="flex w-full min-h-[44px] items-center justify-between rounded-md border-b border-border px-2 py-3 text-left transition-colors last:border-0 hover:bg-accent/30 active:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex items-center gap-2">
                    {isSuccess ? (
                      <CheckCircle2
                        className="size-4 shrink-0 text-healthy"
                        strokeWidth={1.5}
                        aria-hidden="true"
                      />
                    ) : (
                      <XCircle
                        className="size-4 shrink-0 text-critical"
                        strokeWidth={1.5}
                        aria-hidden="true"
                      />
                    )}
                    <span className="sr-only">{isSuccess ? "성공" : "실패"}</span>
                    <span className="truncate text-sm max-w-[50vw] sm:max-w-none">{item.title}</span>
                  </span>
                  <span className="ml-4 shrink-0 text-xs text-muted-foreground">
                    {formatRelativeTime(item.created_at)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function HistorySkeleton() {
  return (
    <div className="space-y-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between py-3">
          <div className="flex items-center gap-2">
            <Skeleton className="size-4 rounded-full" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="h-3 w-14" />
        </div>
      ))}
    </div>
  );
}
