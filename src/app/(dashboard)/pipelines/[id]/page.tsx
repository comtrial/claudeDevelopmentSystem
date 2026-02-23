"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AgentStatusCard } from "@/components/pipeline/agent-status-card";
import { PipelineControls } from "@/components/pipeline/pipeline-controls";
import { LogViewer } from "@/components/pipeline/log-viewer";
import { SessionLifetimeGauge } from "@/components/pipeline/session-lifetime-gauge";
import { usePipelineRealtime } from "@/lib/realtime/use-pipeline-realtime";
import {
  usePipelineStore,
  selectActivePipeline,
  selectAgents,
  selectConnectionStatus,
} from "@/stores/pipeline-store";
import { ScrollText, LayoutGrid, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type PipelineStatus = "draft" | "running" | "paused" | "completed" | "failed" | "cancelled";

const statusColorMap: Record<PipelineStatus, string> = {
  running: "bg-green-500 text-white",
  paused: "bg-yellow-500 text-white",
  completed: "bg-blue-500 text-white",
  failed: "bg-red-500 text-white",
  cancelled: "bg-gray-500 text-white",
  draft: "bg-gray-400 text-white",
};

const statusLabelMap: Record<PipelineStatus, string> = {
  running: "실행 중",
  paused: "일시정지",
  completed: "완료",
  failed: "실패",
  cancelled: "취소됨",
  draft: "초안",
};

export default function PipelineMonitorPage() {
  const params = useParams();
  const router = useRouter();
  const pipelineId = params.id as string;

  const activePipeline = usePipelineStore(selectActivePipeline);
  const agents = usePipelineStore(selectAgents);
  const connectionStatus = usePipelineStore(selectConnectionStatus);
  const { setActivePipeline, setAgents, reset } = usePipelineStore();

  const [isLoading, setIsLoading] = useState(true);
  const [showLogs, setShowLogs] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize realtime subscription
  usePipelineRealtime(pipelineId);

  // Fetch initial pipeline data
  useEffect(() => {
    reset();

    fetch(`/api/pipelines/${pipelineId}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.error) {
          setError(res.error.message);
          return;
        }
        const data = res.data;
        setActivePipeline(data);

        // Map agents from DB to ActiveAgent shape
        const mappedAgents = (data.agents ?? []).map((a: Record<string, unknown>) => ({
          id: a.id as string,
          name: (a.name as string | null) ?? `${String(a.role).toUpperCase()} Agent`,
          role: a.role as string,
          status: (a.status as string | null) ?? "idle",
          currentTask: (a.current_task as string | null) ?? null,
          progress: (a.progress as number | null) ?? 0,
          tokensUsed: 0,
          tokenBudget: 20000,
          lastActivity: (a.updated_at as string | null) ?? new Date().toISOString(),
        }));
        setAgents(mappedAgents);
      })
      .catch(() => setError("파이프라인 데이터를 불러오는 데 실패했습니다."))
      .finally(() => setIsLoading(false));

    return () => reset();
  }, [pipelineId, setActivePipeline, setAgents, reset]);

  const status = (activePipeline?.status as PipelineStatus) ?? "draft";
  const title = (activePipeline?.title as string) ?? "Pipeline";

  // Calculate overall progress from session metadata
  const sessions = (activePipeline?.sessions as Record<string, unknown>[] | null) ?? [];
  const latestSession = sessions[0] ?? null;
  const sessionMetadata = (latestSession?.metadata as Record<string, unknown> | null) ?? null;
  const overallProgress = (sessionMetadata?.progress_percent as number) ?? 0;
  const tokenUsage = (latestSession?.token_usage as number) ?? 0;
  const tokenLimit = (latestSession?.token_limit as number) ?? 100000;
  const sessionId = (latestSession?.id as string) ?? null;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 flex flex-col items-center gap-4">
        <p className="text-destructive">{error}</p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          돌아가기
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/pipelines">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold truncate">{title}</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-2 mt-0.5">
              <span
                className={cn(
                  "inline-block h-2 w-2 rounded-full",
                  connectionStatus === "connected" ? "bg-green-500" : "bg-gray-400"
                )}
              />
              {connectionStatus === "connected" ? "실시간 연결됨" : "연결 중..."}
            </p>
          </div>
        </div>

        <Badge className={cn("shrink-0", statusColorMap[status])}>
          {statusLabelMap[status]}
        </Badge>
      </div>

      {/* Overall progress */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>전체 진행률</span>
          <span>{overallProgress}%</span>
        </div>
        <Progress value={overallProgress} className="h-2" />
      </div>

      {/* Session token gauge */}
      {sessionId && (
        <SessionLifetimeGauge
          sessionId={sessionId}
          tokenUsed={tokenUsage}
          tokenLimit={tokenLimit}
        />
      )}

      {/* Agent cards */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
          <LayoutGrid className="h-4 w-4" />
          에이전트 상태
        </h2>
        {agents.length === 0 ? (
          <p className="text-sm text-muted-foreground">에이전트가 없습니다.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {agents.map((agent) => (
              <AgentStatusCard
                key={agent.id}
                agent={agent}
                onViewLogs={(agentId) => {
                  setShowLogs(true);
                  // Log viewer will filter by agentId when shown
                  console.log("View logs for agent:", agentId);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-3 flex-wrap border-t pt-4">
        <PipelineControls
          pipelineId={pipelineId}
          status={status}
          onStatusChange={(newStatus) => {
            usePipelineStore.getState().updatePipelineStatus({ status: newStatus });
          }}
        />

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowLogs((v) => !v)}
        >
          <ScrollText className="mr-2 h-4 w-4" />
          {showLogs ? "로그 숨기기" : "로그 보기"}
        </Button>

        {(status === "completed" || status === "failed") && (
          <Button variant="secondary" size="sm" asChild>
            <Link href={`/pipelines/${pipelineId}/review`}>코드 리뷰</Link>
          </Button>
        )}
      </div>

      {/* Log viewer */}
      {showLogs && sessionId && (
        <div className="border rounded-xl overflow-hidden">
          <LogViewer pipelineId={pipelineId} />
        </div>
      )}
    </div>
  );
}
