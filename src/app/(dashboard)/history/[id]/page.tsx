"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  FileCode2,
  Coins,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { formatRelativeTime } from "@/lib/utils/format-time";

interface AgentDetail {
  id: string;
  role: string;
  instruction: string | null;
  model: string;
  config: Record<string, unknown>;
}

interface SessionDetail {
  id: string;
  status: string;
  token_usage: number;
  token_limit: number;
  started_at: string | null;
  completed_at: string | null;
}

interface CodeChangeItem {
  id: string;
  session_id: string;
  file_path: string;
  change_type: string;
  additions: number;
  deletions: number;
  review_status: string;
  created_at: string;
}

interface PipelineDetail {
  id: string;
  title: string;
  description: string | null;
  status: "completed" | "failed" | "cancelled";
  mode: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  agents: AgentDetail[];
  sessions: SessionDetail[];
  code_changes: CodeChangeItem[];
}

const STATUS_CONFIG = {
  completed: { label: "완료", icon: CheckCircle2, className: "text-healthy" },
  failed: { label: "실패", icon: XCircle, className: "text-critical" },
  cancelled: { label: "취소됨", icon: Clock, className: "text-muted-foreground" },
} as const;

const ROLE_LABELS: Record<string, string> = {
  pm: "PM",
  engineer: "엔지니어",
  reviewer: "리뷰어",
};

const CHANGE_TYPE_LABELS: Record<string, string> = {
  added: "추가",
  modified: "수정",
  deleted: "삭제",
  renamed: "이름변경",
};

function formatDuration(started: string | null, completed: string | null): string {
  if (!started || !completed) return "-";
  const sec = Math.round((new Date(completed).getTime() - new Date(started).getTime()) / 1000);
  if (sec < 60) return `${sec}초`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}분 ${s}초` : `${m}분`;
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export default function HistoryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [pipeline, setPipeline] = useState<PipelineDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRerunning, setIsRerunning] = useState(false);

  const fetchDetail = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/pipelines/history/${id}`);
      const json = await res.json();
      if (json.error) {
        setError(json.error.message as string);
        return;
      }
      setPipeline(json.data as PipelineDetail);
    } catch {
      setError("상세 정보를 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  async function handleRerun() {
    if (!pipeline) return;
    setIsRerunning(true);
    try {
      const res = await fetch(`/api/pipelines/${pipeline.id}/rerun`, { method: "POST" });
      const json = await res.json();
      if (json.error) {
        toast.error(json.error.message as string);
        return;
      }
      const newId = (json.data as { pipelineId: string }).pipelineId;
      toast.success("파이프라인이 복사되었습니다.");
      router.push(`/pipelines/new?pipeline=${newId}`);
    } catch {
      toast.error("재실행에 실패했습니다.");
    } finally {
      setIsRerunning(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !pipeline) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <XCircle className="h-10 w-10 text-destructive" strokeWidth={1.5} />
        <p className="text-sm text-destructive">{error ?? "파이프라인을 찾을 수 없습니다."}</p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          돌아가기
        </Button>
      </div>
    );
  }

  const config = STATUS_CONFIG[pipeline.status] ?? STATUS_CONFIG.cancelled;
  const StatusIcon = config.icon;
  const totalTokens = pipeline.sessions.reduce((sum, s) => sum + (s.token_usage ?? 0), 0);
  const latestSession = pipeline.sessions[0] ?? null;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => router.push("/history")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold truncate">{pipeline.title}</h1>
              <Badge
                variant="secondary"
                className={cn(
                  "text-xs shrink-0",
                  pipeline.status === "completed" && "bg-healthy/10 text-healthy",
                  pipeline.status === "failed" && "bg-critical/10 text-critical"
                )}
              >
                <StatusIcon className="h-3 w-3 mr-1" />
                {config.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {pipeline.completed_at
                ? `${formatRelativeTime(pipeline.completed_at)} 완료`
                : formatRelativeTime(pipeline.created_at)}
            </p>
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          <Button variant="outline" onClick={() => router.push("/dashboard")}>
            대시보드로
          </Button>
          <Button onClick={() => void handleRerun()} disabled={isRerunning}>
            {isRerunning ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1" />
            )}
            다시 실행
          </Button>
        </div>
      </div>

      {/* 요약 메타 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "소요 시간", value: formatDuration(pipeline.started_at, pipeline.completed_at) },
          { label: "총 토큰", value: formatTokens(totalTokens) },
          { label: "에이전트", value: `${pipeline.agents.length}명` },
          { label: "파일 변경", value: `${pipeline.code_changes.length}개` },
        ].map((m) => (
          <div key={m.label} className="rounded-lg border border-border p-4">
            <p className="text-xs text-muted-foreground">{m.label}</p>
            <p className="text-lg font-semibold mt-1">{m.value}</p>
          </div>
        ))}
      </div>

      {/* 탭 */}
      <Tabs defaultValue="agents">
        <TabsList>
          <TabsTrigger value="agents">에이전트 활동</TabsTrigger>
          <TabsTrigger value="changes">코드 변경</TabsTrigger>
          <TabsTrigger value="tokens">토큰 사용량</TabsTrigger>
        </TabsList>

        {/* 에이전트 활동 탭 */}
        <TabsContent value="agents" className="mt-4 space-y-3">
          {pipeline.agents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">에이전트 정보가 없습니다.</p>
          ) : (
            pipeline.agents.map((agent) => (
              <div key={agent.id} className="rounded-xl border border-border p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "h-2.5 w-2.5 rounded-full",
                        agent.role === "pm" && "bg-purple-500",
                        agent.role === "engineer" && "bg-blue-500",
                        agent.role === "reviewer" && "bg-green-500"
                      )}
                    />
                    <p className="font-medium">{ROLE_LABELS[agent.role] ?? agent.role}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {agent.model.split("-").slice(0, 3).join("-")}
                  </Badge>
                </div>
                {agent.instruction && (
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{agent.instruction}</p>
                )}
              </div>
            ))
          )}
        </TabsContent>

        {/* 코드 변경 탭 */}
        <TabsContent value="changes" className="mt-4">
          {pipeline.code_changes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">코드 변경 사항이 없습니다.</p>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              {pipeline.code_changes.map((change, i) => (
                <div key={change.id}>
                  {i > 0 && <Separator />}
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileCode2 className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-mono text-sm truncate">{change.file_path}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4 text-xs">
                      <span className="text-healthy">+{change.additions}</span>
                      <span className="text-critical">-{change.deletions}</span>
                      <Badge variant="outline" className="text-xs">
                        {CHANGE_TYPE_LABELS[change.change_type] ?? change.change_type}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* 토큰 사용량 탭 */}
        <TabsContent value="tokens" className="mt-4 space-y-4">
          {pipeline.sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">세션 정보가 없습니다.</p>
          ) : (
            <>
              <div className="space-y-4">
                {pipeline.sessions.map((session, i) => {
                  const pct =
                    session.token_limit > 0
                      ? Math.round((session.token_usage / session.token_limit) * 100)
                      : 0;
                  return (
                    <div key={session.id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">세션 {i + 1}</span>
                        <span className="font-medium flex items-center gap-1">
                          <Coins className="h-3.5 w-3.5 text-muted-foreground" />
                          {formatTokens(session.token_usage)}
                          {session.token_limit > 0 && (
                            <span className="text-muted-foreground">
                              {" "}/ {formatTokens(session.token_limit)}
                            </span>
                          )}
                        </span>
                      </div>
                      <Progress
                        value={pct}
                        className={cn(
                          "h-2",
                          pct >= 90 && "[&>div]:bg-critical",
                          pct >= 70 && pct < 90 && "[&>div]:bg-warning"
                        )}
                      />
                      <p className="text-xs text-muted-foreground">{pct}% 사용</p>
                    </div>
                  );
                })}
              </div>

              {latestSession && (
                <>
                  <Separator />
                  <div className="rounded-lg bg-muted/30 p-4">
                    <p className="text-sm font-medium mb-3">전체 요약</p>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">총 토큰 사용</p>
                        <p className="font-semibold">{formatTokens(totalTokens)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">세션 수</p>
                        <p className="font-semibold">{pipeline.sessions.length}</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
