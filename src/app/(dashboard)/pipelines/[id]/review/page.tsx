"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, CheckCircle2, Columns2, AlignLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { FileTree, type FileChange } from "@/components/review/file-tree";
import { ReviewSummary } from "@/components/review/review-summary";
import { DiffViewer, type DiffViewerChange } from "@/components/review/diff-viewer";
import { ReviewActions } from "@/components/review/review-actions";
import type { LineCommentData } from "@/components/review/line-comment";

type DiffMode = "unified" | "split";

interface DetailedChange extends DiffViewerChange {
  additions: number;
  deletions: number;
  review_status: "pending" | "approved" | "rejected" | "changes_requested";
}

export default function ReviewPage() {
  const params = useParams();
  const router = useRouter();
  const pipelineId = params.id as string;

  const [changes, setChanges] = useState<FileChange[]>([]);
  const [activeChangeId, setActiveChangeId] = useState<string | null>(null);
  const [activeDetail, setActiveDetail] = useState<DetailedChange | null>(null);
  const [comments, setComments] = useState<LineCommentData[]>([]);
  const [commentLineNo, setCommentLineNo] = useState<number | null>(null);

  const [diffMode, setDiffMode] = useState<DiffMode>("unified");
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isApproveAllLoading, setIsApproveAllLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pipelineTitle, setPipelineTitle] = useState<string>("Code Review");

  // 파이프라인 제목 조회
  useEffect(() => {
    fetch(`/api/pipelines/${pipelineId}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.data?.title) setPipelineTitle(res.data.title as string);
      })
      .catch(() => {});
  }, [pipelineId]);

  // 변경 파일 목록 조회
  useEffect(() => {
    setIsLoading(true);
    fetch(`/api/pipelines/${pipelineId}/changes`)
      .then((r) => r.json())
      .then((res) => {
        if (res.error) {
          setError(res.error.message as string);
          return;
        }
        const rawList = res.data;
        const list: FileChange[] = Array.isArray(rawList)
          ? rawList.filter(
              (item: unknown): item is FileChange =>
                typeof item === "object" &&
                item !== null &&
                "id" in item &&
                "file_path" in item &&
                "change_type" in item
            )
          : [];
        setChanges(list);
        if (list.length > 0) {
          setActiveChangeId(list[0].id);
        }
      })
      .catch(() => setError("변경 사항을 불러오는 데 실패했습니다."))
      .finally(() => setIsLoading(false));
  }, [pipelineId]);

  // 활성 파일 상세 diff 조회
  useEffect(() => {
    if (!activeChangeId) return;
    setIsDetailLoading(true);
    setActiveDetail(null);

    fetch(`/api/pipelines/${pipelineId}/changes/${activeChangeId}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.error || !res.data) return;
        const d = res.data as Record<string, unknown>;
        if (typeof d.id === "string" && typeof d.file_path === "string") {
          setActiveDetail(d as unknown as DetailedChange);
        }
      })
      .catch(() => {})
      .finally(() => setIsDetailLoading(false));

    // 댓글 목록 조회
    fetch(`/api/pipelines/${pipelineId}/changes/${activeChangeId}/comments`)
      .then((r) => r.json())
      .then((res) => {
        if (!res.error && Array.isArray(res.data)) {
          setComments(res.data as LineCommentData[]);
        }
      })
      .catch(() => {});
  }, [activeChangeId, pipelineId]);

  const handleStatusChange = useCallback(
    (changeId: string, newStatus: string) => {
      setChanges((prev) =>
        prev.map((c) =>
          c.id === changeId
            ? { ...c, review_status: newStatus as FileChange["review_status"] }
            : c
        )
      );
      setActiveDetail((prev) =>
        prev && prev.id === changeId
          ? { ...prev, review_status: newStatus as DetailedChange["review_status"] }
          : prev
      );
    },
    []
  );

  async function handleApproveAll() {
    setIsApproveAllLoading(true);
    try {
      const res = await fetch(`/api/pipelines/${pipelineId}/review/approve-all`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.error) {
        toast.error((json.error.message as string) ?? "일괄 승인 실패");
        return;
      }
      setChanges((prev) =>
        prev.map((c) =>
          c.review_status === "pending" ? { ...c, review_status: "approved" as const } : c
        )
      );
      setActiveDetail((prev) =>
        prev?.review_status === "pending" ? { ...prev, review_status: "approved" } : prev
      );
      toast.success(`${(json.data as { approved_count: number }).approved_count}개 파일이 승인되었습니다.`);
    } catch {
      toast.error("서버 오류가 발생했습니다.");
    } finally {
      setIsApproveAllLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="flex gap-4">
          <Skeleton className="h-96 w-56 shrink-0" />
          <Skeleton className="h-96 flex-1" />
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

  const pendingCount = changes.filter((c) => c.review_status === "pending").length;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-4 px-4 py-3 border-b shrink-0 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/pipelines/${pipelineId}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="font-semibold truncate">코드 리뷰 — {pipelineTitle}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {changes.length}개 파일 변경됨
              {pendingCount > 0 && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {pendingCount}개 대기
                </Badge>
              )}
            </p>
          </div>
        </div>

        {/* 뷰 모드 토글 */}
        <Tabs value={diffMode} onValueChange={(v) => setDiffMode(v as DiffMode)}>
          <TabsList className="h-8">
            <TabsTrigger value="unified" className="h-6 px-2 text-xs gap-1">
              <AlignLeft className="h-3 w-3" />
              통합
            </TabsTrigger>
            <TabsTrigger value="split" className="h-6 px-2 text-xs gap-1">
              <Columns2 className="h-3 w-3" />
              분할
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* 메인 레이아웃 */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* 사이드바: 파일 목록 + 리뷰 요약 */}
        <aside className="w-56 lg:w-64 shrink-0 border-r flex flex-col min-h-0">
          {/* 리뷰 요약 */}
          <div className="p-3 border-b">
            <ReviewSummary changes={changes} />
          </div>

          {/* 파일 목록 */}
          <ScrollArea className="flex-1 p-2">
            {changes.length === 0 ? (
              <p className="text-sm text-muted-foreground px-2 py-4">변경 파일이 없습니다.</p>
            ) : (
              <FileTree
                changes={changes}
                activeChangeId={activeChangeId}
                onSelect={setActiveChangeId}
              />
            )}
          </ScrollArea>

          {/* 일괄 승인 */}
          {pendingCount > 0 && (
            <div className="p-3 border-t">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    className="w-full gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                    disabled={isApproveAllLoading}
                  >
                    {isApproveAllLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                    전체 승인 ({pendingCount})
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>대기 중인 변경 사항을 모두 승인하시겠습니까?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {pendingCount}개의 파일이 일괄 승인됩니다. 모든 파일이 승인되면 파이프라인이 완료됩니다.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>취소</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={handleApproveAll}
                    >
                      전체 승인
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </aside>

        {/* 메인: Diff 뷰어 + 리뷰 액션 */}
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {!activeChangeId || changes.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-muted-foreground">
              <p>파일을 선택해 주세요.</p>
            </div>
          ) : isDetailLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : activeDetail ? (
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
              {/* 파일 헤더 */}
              <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b bg-muted/30 shrink-0 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="font-mono text-sm truncate text-foreground"
                    title={activeDetail.file_path}
                  >
                    {activeDetail.file_path}
                  </span>
                  <Badge variant="outline" className="shrink-0 text-xs capitalize">
                    {activeDetail.change_type}
                  </Badge>
                </div>

                {/* 리뷰 액션 */}
                <ReviewActions
                  pipelineId={pipelineId}
                  changeId={activeDetail.id}
                  currentStatus={activeDetail.review_status}
                  onStatusChange={(newStatus) => handleStatusChange(activeDetail.id, newStatus)}
                />
              </div>

              {/* Diff 뷰어 */}
              <ScrollArea className="flex-1">
                <DiffViewer
                  change={activeDetail}
                  mode={diffMode}
                  onLineComment={(lineNo) => setCommentLineNo(lineNo)}
                />
              </ScrollArea>

              {/* 라인 댓글 패널 */}
              {commentLineNo !== null && (
                <>
                  <Separator />
                  <div className="p-4 bg-muted/20 shrink-0">
                    <InlineCommentPanel
                      changeId={activeDetail.id}
                      pipelineId={pipelineId}
                      lineNumber={commentLineNo}
                      existingComments={comments}
                      onCommentAdded={(comment) => {
                        setComments((prev) => [...prev, comment]);
                        setCommentLineNo(null);
                      }}
                      onCancel={() => setCommentLineNo(null)}
                    />
                  </div>
                </>
              )}
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}

// 인라인 댓글 입력 패널
interface InlineCommentPanelProps {
  changeId: string;
  pipelineId: string;
  lineNumber: number;
  existingComments: LineCommentData[];
  onCommentAdded: (comment: LineCommentData) => void;
  onCancel: () => void;
}

function InlineCommentPanel({
  changeId,
  pipelineId,
  lineNumber,
  existingComments,
  onCommentAdded,
  onCancel,
}: InlineCommentPanelProps) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const lineComments = existingComments.filter((c) => c.line_number === lineNumber);

  async function handleSubmit() {
    if (!text.trim()) return;
    setSubmitting(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/pipelines/${pipelineId}/changes/${changeId}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ line_number: lineNumber, content: text.trim() }),
        }
      );
      const json = await res.json();
      if (json.error) {
        setErr((json.error.message as string) ?? "댓글 저장 실패");
        return;
      }
      onCommentAdded(json.data as LineCommentData);
      setText("");
    } catch {
      setErr("서버 오류");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">라인 {lineNumber} 댓글</p>

      {lineComments.length > 0 && (
        <div className="space-y-2 max-h-32 overflow-y-auto border rounded-md p-2 bg-background">
          {lineComments.map((c) => (
            <div key={c.id} className="text-sm">
              <span className="text-xs text-muted-foreground mr-2">
                {c.author_type === "user" ? "나" : "에이전트"}
              </span>
              {c.content}
            </div>
          ))}
        </div>
      )}

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="댓글을 입력하세요... (Cmd+Enter로 제출)"
        className="min-h-[72px] text-sm resize-none"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void handleSubmit();
          }
        }}
      />
      {err && <p className="text-xs text-destructive">{err}</p>}
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          취소
        </Button>
        <Button size="sm" disabled={!text.trim() || submitting} onClick={() => void handleSubmit()}>
          {submitting ? "저장 중..." : "댓글 추가"}
        </Button>
      </div>
    </div>
  );
}
