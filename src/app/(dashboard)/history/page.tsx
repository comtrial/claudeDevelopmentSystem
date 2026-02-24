"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Users,
  Coins,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelativeTime } from "@/lib/utils/format-time";

interface HistoryPipeline {
  id: string;
  title: string;
  description: string | null;
  status: "completed" | "failed" | "cancelled";
  mode: string;
  created_at: string;
  completed_at: string | null;
  agent_count: number;
  agent_roles: string[];
  total_tokens: number;
  duration_sec: number | null;
  session_count: number;
}

interface HistoryData {
  pipelines: HistoryPipeline[];
  total: number;
  page: number;
  totalPages: number;
}

const STATUS_CONFIG = {
  completed: { label: "완료", icon: CheckCircle2, className: "text-healthy" },
  failed: { label: "실패", icon: XCircle, className: "text-critical" },
  cancelled: { label: "취소됨", icon: Clock, className: "text-muted-foreground" },
} as const;

function formatDuration(sec: number | null): string {
  if (sec === null) return "-";
  if (sec < 60) return `${sec}초`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}분 ${s}초` : `${m}분`;
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export default function HistoryPage() {
  const router = useRouter();

  const [data, setData] = useState<HistoryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestSearch = useRef(search);
  const latestStatus = useRef(status);
  const latestSort = useRef(sort);
  const latestPage = useRef(page);

  const fetchHistory = useCallback(
    async (params: { search: string; status: string; sort: string; page: number }) => {
      setIsLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({
          status: params.status,
          sort: params.sort,
          page: String(params.page),
        });
        if (params.search.trim()) qs.set("search", params.search.trim());

        const res = await fetch(`/api/pipelines/history?${qs.toString()}`);
        const json = await res.json();
        if (json.error) {
          setError(json.error.message as string);
          return;
        }
        const d = json.data;
        if (
          d &&
          typeof d === "object" &&
          Array.isArray((d as Record<string, unknown>).pipelines) &&
          typeof (d as Record<string, unknown>).total === "number"
        ) {
          setData(d as HistoryData);
        } else {
          setError("응답 형식이 올바르지 않습니다.");
        }
      } catch {
        setError("히스토리를 불러오지 못했습니다.");
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Initial fetch
  useEffect(() => {
    void fetchHistory({ search: "", status: "all", sort: "newest", page: 1 });
  }, [fetchHistory]);

  // Debounced search
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearch(value);
      latestSearch.current = value;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setPage(1);
        latestPage.current = 1;
        void fetchHistory({
          search: value,
          status: latestStatus.current,
          sort: latestSort.current,
          page: 1,
        });
      }, 300);
    },
    [fetchHistory]
  );

  const handleStatusChange = useCallback(
    (value: string) => {
      setStatus(value);
      latestStatus.current = value;
      setPage(1);
      latestPage.current = 1;
      void fetchHistory({ search: latestSearch.current, status: value, sort: latestSort.current, page: 1 });
    },
    [fetchHistory]
  );

  const handleSortChange = useCallback(
    (value: string) => {
      setSort(value);
      latestSort.current = value;
      setPage(1);
      latestPage.current = 1;
      void fetchHistory({ search: latestSearch.current, status: latestStatus.current, sort: value, page: 1 });
    },
    [fetchHistory]
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      setPage(newPage);
      latestPage.current = newPage;
      void fetchHistory({ search: latestSearch.current, status: latestStatus.current, sort: latestSort.current, page: newPage });
    },
    [fetchHistory]
  );

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">작업 히스토리</h1>
        <p className="text-sm text-muted-foreground mt-1">완료된 파이프라인 실행 내역</p>
      </div>

      {/* 필터 바 */}
      <div className="flex flex-wrap gap-3">
        <div className="relative w-full sm:flex-1 sm:min-w-[200px] sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="파이프라인 검색..."
            className="pl-9 text-base md:text-sm"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>

        <div className="flex gap-3 w-full sm:w-auto">
          <Select value={status} onValueChange={handleStatusChange}>
            <SelectTrigger className="flex-1 sm:w-36">
              <SelectValue placeholder="상태" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="completed">완료</SelectItem>
              <SelectItem value="failed">실패</SelectItem>
              <SelectItem value="cancelled">취소됨</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sort} onValueChange={handleSortChange}>
            <SelectTrigger className="flex-1 sm:w-36">
              <SelectValue placeholder="정렬" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">최신순</SelectItem>
              <SelectItem value="oldest">오래된순</SelectItem>
              <SelectItem value="most_tokens">토큰 많은순</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 결과 */}
      {isLoading ? (
        <HistorySkeleton />
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => void fetchHistory({ search, status, sort, page })}
          >
            재시도
          </Button>
        </div>
      ) : !data || data.pipelines.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            총 {data.total}개 중 {data.pipelines.length}개 표시
          </p>

          <div className="space-y-3">
            {data.pipelines.map((p) => (
              <HistoryCard
                key={p.id}
                pipeline={p}
                onClick={() => router.push(`/history/${p.id}`)}
              />
            ))}
          </div>

          {/* 페이지네이션 */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="min-h-[44px] min-w-[44px]"
                disabled={page <= 1}
                onClick={() => handlePageChange(page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">이전</span>
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} / {data.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="min-h-[44px] min-w-[44px]"
                disabled={page >= data.totalPages}
                onClick={() => handlePageChange(page + 1)}
              >
                <span className="hidden sm:inline">다음</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface HistoryCardProps {
  pipeline: HistoryPipeline;
  onClick: () => void;
}

function HistoryCard({ pipeline, onClick }: HistoryCardProps) {
  const config = STATUS_CONFIG[pipeline.status] ?? STATUS_CONFIG.cancelled;
  const Icon = config.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-xl border border-border p-4 transition-colors hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[44px]"
    >
      <div className="flex items-start justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Icon className={cn("h-5 w-5 shrink-0", config.className)} strokeWidth={1.5} />
          <div className="min-w-0">
            <p className="font-medium truncate text-sm sm:text-base">{pipeline.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {pipeline.completed_at
                ? formatRelativeTime(pipeline.completed_at)
                : formatRelativeTime(pipeline.created_at)}
            </p>
          </div>
        </div>
        <Badge
          variant="secondary"
          className={cn(
            "shrink-0 text-xs",
            pipeline.status === "completed" && "bg-healthy/10 text-healthy",
            pipeline.status === "failed" && "bg-critical/10 text-critical"
          )}
        >
          {config.label}
        </Badge>
      </div>

      <Progress
        value={pipeline.status === "completed" ? 100 : pipeline.status === "failed" ? 100 : 50}
        className={cn(
          "h-1 mt-3",
          pipeline.status === "completed" && "[&>div]:bg-healthy",
          pipeline.status === "failed" && "[&>div]:bg-critical"
        )}
      />

      <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          에이전트 {pipeline.agent_count}명
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatDuration(pipeline.duration_sec)}
        </span>
        <span className="flex items-center gap-1">
          <Coins className="h-3 w-3" />
          {formatTokens(pipeline.total_tokens)} 토큰
        </span>
      </div>
    </button>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <Clock className="h-12 w-12 text-muted-foreground/40" strokeWidth={1} />
      <div>
        <p className="font-medium">아직 완료된 작업이 없습니다</p>
        <p className="text-sm text-muted-foreground mt-1">
          파이프라인을 실행하면 여기에서 결과를 확인할 수 있습니다
        </p>
      </div>
      <Button asChild variant="outline" size="sm">
        <Link href="/pipelines/new">새 파이프라인 만들기</Link>
      </Button>
    </div>
  );
}

function HistorySkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-5 rounded-full" />
              <div>
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-24 mt-1" />
              </div>
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-1 w-full rounded-full" />
          <div className="flex gap-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}
