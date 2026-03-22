"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, FileText, RefreshCw, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ApiResponse } from "@/types/api";

interface NotionPageItem {
  id: string;
  title: string;
  icon: string | null;
  last_edited: string;
  has_children: boolean;
}

interface NotionPageListProps {
  onSelect: (pageId: string, title: string) => void;
  selectedPageId: string | null;
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHour = Math.floor(diffMs / 3_600_000);
  const diffDay = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 30) return `${diffDay}일 전`;
  return new Date(dateStr).toLocaleDateString("ko-KR");
}

export function NotionPageList({ onSelect, selectedPageId }: NotionPageListProps) {
  const [pages, setPages] = useState<NotionPageItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchPages = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/notion/pages");
      const json: ApiResponse<{ pages: NotionPageItem[] }> = await res.json();

      if (json.error) {
        setError(json.error.message);
        return;
      }

      if (json.data) {
        setPages(json.data.pages);
      }
    } catch {
      setError("Notion 페이지 목록을 불러올 수 없습니다.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return pages;
    const q = searchQuery.toLowerCase();
    return pages.filter((p) => p.title.toLowerCase().includes(q));
  }, [pages, searchQuery]);

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <div className="h-9 animate-pulse rounded-lg bg-muted" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-lg border p-3"
          >
            <div className="size-8 animate-pulse rounded-md bg-muted" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-6 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchPages}>
          <RefreshCw className="size-3.5" />
          다시 시도
        </Button>
      </div>
    );
  }

  // Empty state
  if (pages.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center">
        <FileText className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          연결된 Notion 페이지가 없습니다
        </p>
        <Button variant="outline" size="sm" onClick={fetchPages}>
          <RefreshCw className="size-3.5" />
          새로고침
        </Button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className="flex flex-col gap-2"
    >
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="페이지 검색..."
          className="pl-9 text-sm"
        />
      </div>

      {/* Page list */}
      <div className="flex max-h-[280px] flex-col gap-1.5 overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {filtered.length === 0 ? (
            <motion.p
              key="no-results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-4 text-center text-sm text-muted-foreground"
            >
              검색 결과가 없습니다
            </motion.p>
          ) : (
            filtered.map((page) => {
              const isSelected = page.id === selectedPageId;
              return (
                <motion.button
                  key={page.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  type="button"
                  onClick={() => onSelect(page.id, page.title)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-2.5 text-left transition-colors sm:p-3",
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                      : "border-border hover:border-muted-foreground/30"
                  )}
                >
                  <div className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-md text-base",
                    isSelected ? "bg-primary/10" : "bg-muted"
                  )}>
                    {page.icon ?? <FileText className="size-4 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={cn(
                      "truncate text-sm font-medium",
                      isSelected && "text-primary"
                    )}>
                      {page.title || "제목 없음"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatRelativeTime(page.last_edited)}
                    </div>
                  </div>
                </motion.button>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* Refresh button */}
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="xs"
          onClick={fetchPages}
          className="text-muted-foreground"
        >
          <RefreshCw className="size-3" />
          새로고침
        </Button>
      </div>
    </motion.div>
  );
}
