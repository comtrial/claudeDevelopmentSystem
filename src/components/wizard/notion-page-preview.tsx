"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, FileCheck, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ApiResponse } from "@/types/api";

interface NotionPagePreviewProps {
  pageId: string;
  pageTitle: string;
  onConfirm: (content: string) => void;
  onBack: () => void;
}

interface PageContentResult {
  content: string;
  title: string;
  word_count: number;
}

export function NotionPagePreview({ pageId, pageTitle, onConfirm, onBack }: NotionPagePreviewProps) {
  const [content, setContent] = useState("");
  const [wordCount, setWordCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContent = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/notion/pages/${pageId}`);
      const json: ApiResponse<PageContentResult> = await res.json();

      if (json.error) {
        setError(json.error.message);
        return;
      }

      if (json.data) {
        setContent(json.data.content);
        setWordCount(json.data.word_count);
      }
    } catch {
      setError("페이지 내용을 불러올 수 없습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [pageId]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  // Loading state
  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8"
      >
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">페이지 내용을 불러오는 중...</p>
      </motion.div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-6 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="size-3.5" />
            돌아가기
          </Button>
          <Button variant="outline" size="sm" onClick={fetchContent}>
            다시 시도
          </Button>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className="flex flex-col gap-3"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="truncate text-sm font-medium">{pageTitle}</h4>
        <Badge variant="secondary" className="shrink-0 text-[10px]">
          {wordCount.toLocaleString()}자
        </Badge>
      </div>

      {/* Content preview */}
      <div className={cn(
        "max-h-[300px] overflow-y-auto rounded-lg border bg-muted/30 p-3 sm:p-4",
        "prose prose-sm prose-neutral dark:prose-invert max-w-none",
        "[&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_p]:text-sm [&_li]:text-sm"
      )}>
        {content.trim() ? (
          <ReactMarkdown>{content}</ReactMarkdown>
        ) : (
          <p className="text-sm text-muted-foreground">빈 페이지입니다.</p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="size-3.5" />
          돌아가기
        </Button>
        <Button
          size="sm"
          onClick={() => onConfirm(content)}
          disabled={!content.trim()}
        >
          <FileCheck className="size-3.5" />
          이 문서로 분석하기
        </Button>
      </div>
    </motion.div>
  );
}
