"use client";

import { useEffect, useState, useCallback } from "react";
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
import { FollowUpInput } from "@/components/pipeline/follow-up-input";
import { ExecutionSummary } from "@/components/pipeline/execution-summary";
import { SessionSelector } from "@/components/pipeline/session-selector";
import { TaskProgressTimeline } from "@/components/pipeline/task-progress-timeline";
import { usePipelineRealtime } from "@/lib/realtime/use-pipeline-realtime";
import {
  usePipelineStore,
  selectActivePipeline,
  selectAgents,
  selectTasks,
  selectLogs,
  selectConnectionStatus,
} from "@/stores/pipeline-store";
import type { SessionSummary } from "@/types/session";
import type { Task } from "@/types/pipeline";
import { ScrollText, LayoutGrid, ArrowLeft, MessageSquareText, Lightbulb } from "lucide-react";
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
  const tasks = usePipelineStore(selectTasks);
  const logs = usePipelineStore(selectLogs);
  const connectionStatus = usePipelineStore(selectConnectionStatus);
  const { setActivePipeline, setAgents, setTasks, reset, clearLogs, setActiveSessionId } = usePipelineStore();

  const [isLoading, setIsLoading] = useState(true);
  const [showLogs, setShowLogs] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionIdLocal] = useState<string | null>(null);

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

        // Load tasks
        setTasks((data.tasks as Task[]) ?? []);

        // Set active session to the latest one
        const sessionList = (data.sessions as Record<string, unknown>[] | null) ?? [];
        if (sessionList.length > 0) {
          const latestId = sessionList[0].id as string;
          setActiveSessionIdLocal(latestId);
          setActiveSessionId(latestId);
        }
      })
      .catch(() => setError("파이프라인 데이터를 불러오는 데 실패했습니다."))
      .finally(() => setIsLoading(false));

    return () => reset();
  }, [pipelineId, setActivePipeline, setAgents, setTasks, reset, setActiveSessionId]);

  const status = (activePipeline?.status as PipelineStatus) ?? "draft";
  const title = (activePipeline?.title as string) ?? "Pipeline";
  const originalQuery = (activePipeline?.original_query as string | null) ?? null;
  const pipelineStartedAt = (activePipeline?.started_at as string | null) ?? null;
  const pipelineConfig = (activePipeline?.config as Record<string, unknown> | null) ?? null;
  const analysis = (pipelineConfig?.analysis as { intent?: string; scope?: string; reasoning?: string } | null) ?? null;

  // Build session summaries from pipeline data
  const sessions = (activePipeline?.sessions as Record<string, unknown>[] | null) ?? [];
  const sessionSummaries: SessionSummary[] = sessions.map((s) => ({
    id: s.id as string,
    status: (s.status as SessionSummary["status"]) ?? "initializing",
    session_number: (s.session_number as number) ?? 1,
    follow_up_prompt: (s.follow_up_prompt as string | null) ?? null,
    started_at: (s.started_at as string) ?? "",
  }));

  // Find active session summary for follow-up prompt display
  const activeSessionSummary = sessionSummaries.find((s) => s.id === activeSessionId) ?? null;
  const activeSessionFollowUp = activeSessionSummary?.follow_up_prompt ?? null;

  // Find active session data for progress/token display
  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? sessions[0] ?? null;
  const sessionMetadata = (activeSession?.metadata as Record<string, unknown> | null) ?? null;
  const overallProgress = (sessionMetadata?.progress_percent as number) ?? 0;
  const tokenUsage = (activeSession?.token_usage as number) ?? 0;
  const tokenLimit = (activeSession?.token_limit as number) ?? 100000;
  const sessionId = (activeSession?.id as string) ?? null;

  const handleSessionSelect = useCallback((id: string) => {
    setActiveSessionIdLocal(id);
    setActiveSessionId(id);
    clearLogs();
  }, [setActiveSessionId, clearLogs]);

  const handleFollowUpSubmit = useCallback((newSessionId: string) => {
    // Refresh pipeline data to pick up the new session
    fetch(`/api/pipelines/${pipelineId}`)
      .then((r) => r.json())
      .then((res) => {
        if (!res.error) {
          setActivePipeline(res.data);
        }
      });

    // Switch to new session
    clearLogs();
    setActiveSessionIdLocal(newSessionId);
    setActiveSessionId(newSessionId);
  }, [pipelineId, setActivePipeline, clearLogs, setActiveSessionId]);

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

      {/* Query display */}
      {(originalQuery || activeSessionFollowUp) && (
        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
          {originalQuery && (
            <div className="flex gap-2">
              <MessageSquareText className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground mb-1">원본 질의</p>
                <p className="text-sm whitespace-pre-wrap break-words">{originalQuery}</p>
              </div>
            </div>
          )}
          {analysis?.intent && (
            <div className="flex gap-2" data-testid="analysis-intent">
              <Lightbulb className="h-4 w-4 mt-0.5 shrink-0 text-yellow-500" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-yellow-600 mb-1">시스템 이해</p>
                <p className="text-sm">{analysis.intent}</p>
                {analysis.reasoning && (
                  <p className="text-xs text-muted-foreground mt-1">{analysis.reasoning}</p>
                )}
              </div>
            </div>
          )}
          {activeSessionFollowUp && (
            <div className="flex gap-2">
              <MessageSquareText className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-blue-500 mb-1">
                  후속 질의 #{activeSessionSummary?.session_number ?? ""}
                </p>
                <p className="text-sm whitespace-pre-wrap break-words">{activeSessionFollowUp}</p>
              </div>
            </div>
          )}
        </div>
      )}

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
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-4">
            {agents.map((agent) => (
              <AgentStatusCard
                key={agent.id}
                agent={agent}
                onViewLogs={() => {
                  setShowLogs(true);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Task progress timeline */}
      {tasks.length > 0 && (
        <TaskProgressTimeline tasks={tasks} startedAt={pipelineStartedAt} />
      )}

      {/* Action bar */}
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap border-t pt-4">
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

      {/* Execution summary (shown when completed/failed) */}
      {(status === "completed" || status === "failed") && logs.length > 0 && (
        <ExecutionSummary logs={logs} status={status} />
      )}

      {/* Follow-up input (shown when completed/failed) */}
      {(status === "completed" || status === "failed") && (
        <div className="border rounded-lg p-3">
          <FollowUpInput
            pipelineId={pipelineId}
            onSubmit={handleFollowUpSubmit}
          />
        </div>
      )}

      {/* Session selector (shown when multiple sessions exist) */}
      {sessionSummaries.length > 1 && activeSessionId && (
        <SessionSelector
          sessions={sessionSummaries}
          activeSessionId={activeSessionId}
          onSelect={handleSessionSelect}
        />
      )}

      {/* Log viewer — full-bleed on mobile */}
      {showLogs && (
        <div className="-mx-4 sm:mx-0 sm:border sm:rounded-xl overflow-hidden">
          <LogViewer
            pipelineId={pipelineId}
            sessionId={activeSessionId ?? undefined}
          />
        </div>
      )}
    </div>
  );
}
