"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { MessageSquare, User, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LineCommentData {
  id: string;
  change_id: string;
  line_number: number;
  content: string;
  author_type: "user" | "agent";
  author_id: string;
  agent_id?: string | null;
  created_at: string;
}

interface LineCommentProps {
  changeId: string;
  lineNumber: number;
  pipelineId: string;
  existingComments?: LineCommentData[];
  onCommentAdded?: (comment: LineCommentData) => void;
  trigger?: React.ReactNode;
}

export function LineComment({
  changeId,
  lineNumber,
  pipelineId,
  existingComments = [],
  onCommentAdded,
  trigger,
}: LineCommentProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lineComments = existingComments.filter((c) => c.line_number === lineNumber);

  async function handleSubmit() {
    if (!text.trim()) return;
    setSubmitting(true);
    setError(null);

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
        setError(json.error.message ?? "댓글 저장 실패");
        return;
      }
      onCommentAdded?.(json.data as LineCommentData);
      setText("");
      setOpen(false);
    } catch {
      setError("서버 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <button className="text-muted-foreground hover:text-foreground transition-colors">
            <MessageSquare className="h-3.5 w-3.5" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" side="bottom" align="start">
        <div className="p-3 space-y-3">
          {/* 기존 댓글 목록 */}
          {lineComments.length > 0 && (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {lineComments.map((comment) => (
                <div key={comment.id} className="flex gap-2 text-sm">
                  <div className="shrink-0 mt-0.5">
                    {comment.author_type === "user" ? (
                      <User className="h-3.5 w-3.5 text-blue-500" />
                    ) : (
                      <Bot className="h-3.5 w-3.5 text-purple-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground mb-0.5">
                      {comment.author_type === "user" ? "나" : "에이전트"}
                      <span className="ml-2">
                        {new Date(comment.created_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </p>
                    <p className="text-foreground break-words">{comment.content}</p>
                  </div>
                </div>
              ))}
              <div className="border-t" />
            </div>
          )}

          {/* 라인 번호 표시 */}
          <p className="text-xs text-muted-foreground">라인 {lineNumber}에 댓글</p>

          {/* 댓글 입력 */}
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="댓글을 입력하세요..."
            className="min-h-[72px] text-sm resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!text.trim() || submitting}
              className={cn(submitting && "opacity-70")}
            >
              {submitting ? "저장 중..." : "댓글 추가"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
