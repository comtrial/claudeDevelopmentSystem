"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Loader2, Wand2, Code, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useWizardStore } from "@/stores/wizard-store";
import type { ParsedTask, ParseAnalysis, Recommendation } from "@/types/wizard";
import type { ApiResponse } from "@/types/api";
import { cn } from "@/lib/utils";
import { TaskCardList } from "./task-card-list";
import { RecommendationBanner } from "./recommendation-banner";
import { WorkingDirInput } from "./working-dir-input";
import { TaskEmptyState } from "./task-empty-state";

const MIN_LENGTH = 10;
const MAX_LENGTH = 2000;
const TIMEOUT_MS = 200_000;

interface ParseResult {
  analysis?: ParseAnalysis;
  tasks: ParsedTask[];
  recommendation: Recommendation;
}

export function StepTaskInput() {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const category = useWizardStore((s) => s.category);
  const workingDir = useWizardStore((s) => s.workingDir);
  const tasks = useWizardStore((s) => s.tasks);
  const setCategory = useWizardStore((s) => s.setCategory);
  const setTasks = useWizardStore((s) => s.setTasks);
  const setRecommendation = useWizardStore((s) => s.setRecommendation);
  const setAnalysis = useWizardStore((s) => s.setAnalysis);
  const setOriginalQuery = useWizardStore((s) => s.setOriginalQuery);

  const trimmed = input.trim();
  const isTooShort = trimmed.length > 0 && trimmed.length < MIN_LENGTH;
  const needsWorkingDir = category === "development" && !workingDir.trim();
  const canAnalyze = trimmed.length >= MIN_LENGTH && !needsWorkingDir && !isLoading;

  const handleParse = useCallback(async () => {
    if (!canAnalyze) return;

    setIsLoading(true);
    setError(null);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch("/api/pipelines/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: input.trim() }),
        signal: controller.signal,
      });

      const json: ApiResponse<ParseResult> = await res.json();

      if (json.error) {
        setError(json.error.message);
        return;
      }

      if (json.data) {
        setTasks(json.data.tasks);
        setRecommendation(json.data.recommendation);
        setAnalysis(json.data.analysis ?? null);
        setOriginalQuery(input.trim());

        // Scroll results into view
        setTimeout(() => {
          resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }, 100);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("분석 요청이 시간 초과되었습니다. 다시 시도해주세요.");
      } else {
        setError("분석 중 오류가 발생했습니다.");
      }
    } finally {
      clearTimeout(timeout);
      setIsLoading(false);
    }
  }, [canAnalyze, input, setTasks, setRecommendation, setAnalysis, setOriginalQuery]);

  // Cmd+Enter keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleParse();
      }
    };
    const textarea = textareaRef.current;
    textarea?.addEventListener("keydown", handler);
    return () => textarea?.removeEventListener("keydown", handler);
  }, [handleParse]);

  const placeholder =
    category === "development"
      ? workingDir.trim()
        ? "예: src/components/Button.tsx에 loading 상태 추가하고 테스트 작성"
        : "먼저 위 프로젝트 디렉토리를 지정해주세요"
      : "예: 이 프로젝트의 아키텍처를 분석하고 개선점을 문서화해주세요";

  const showCharCount = input.length > MAX_LENGTH * 0.8;

  return (
    <Card>
      <CardHeader>
        <CardTitle>작업 정의</CardTitle>
        <CardDescription>
          에이전트가 수행할 작업을 정의하고 분석하세요.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-3 sm:gap-5 sm:px-6">
        {/* ── Config Zone ── */}
        <div className="flex flex-col gap-3 rounded-xl bg-muted/30 p-2.5 sm:gap-4 sm:p-4">
          {/* Category selector */}
          <div className="flex gap-2">
            <CategoryButton
              active={category === "development"}
              onClick={() => setCategory("development")}
              icon={<Code className="size-4" />}
              label="개발"
              description="코드 작성/수정/리팩토링"
            />
            <CategoryButton
              active={category === "general"}
              onClick={() => setCategory("general")}
              icon={<FileText className="size-4" />}
              label="범용"
              description="분석/문서화/리서치"
            />
          </div>

          {/* Working directory (development only) */}
          <WorkingDirInput />

          {/* Task description textarea */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-medium">작업 설명</Label>
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={placeholder}
                maxLength={MAX_LENGTH}
                rows={3}
                disabled={isLoading}
                className="w-full resize-none rounded-lg border bg-background px-3 py-2.5 text-base placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-50 sm:px-4 sm:py-3 sm:text-sm"
              />
              {showCharCount && (
                <span className="absolute bottom-2 right-3 text-[10px] text-muted-foreground">
                  {input.length}/{MAX_LENGTH}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Analyze Action Bar ── */}
        <Separator />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button
              onClick={handleParse}
              disabled={!canAnalyze}
              className="min-w-[100px] sm:min-w-[120px]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" />
                  분석 중...
                </>
              ) : (
                <>
                  <Wand2 />
                  작업 분석
                </>
              )}
            </Button>
            {!isLoading && canAnalyze && (
              <kbd className="hidden items-center gap-0.5 rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline-flex">
                <span className="text-xs">&#8984;</span>Enter
              </kbd>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isTooShort && (
              <p className="text-xs text-muted-foreground">
                최소 {MIN_LENGTH}자 이상 ({trimmed.length}/{MIN_LENGTH})
              </p>
            )}
            {needsWorkingDir && trimmed.length >= MIN_LENGTH && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                프로젝트 디렉토리를 지정해주세요
              </p>
            )}
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
          </div>
        </div>

        {/* ── Results Zone ── */}
        <div ref={resultsRef}>
          <RecommendationBanner />
          {isLoading ? (
            <TaskCardSkeleton />
          ) : tasks.length > 0 ? (
            <TaskCardList />
          ) : (
            <TaskEmptyState
              hasInput={trimmed.length > 0}
              needsWorkingDir={needsWorkingDir && trimmed.length >= MIN_LENGTH}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CategoryButton({
  active,
  onClick,
  icon,
  label,
  description,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center gap-2 rounded-lg border p-2.5 text-left transition-colors sm:gap-3 sm:p-3",
        active
          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
          : "border-border hover:border-muted-foreground/30"
      )}
    >
      <div className={cn(
        "flex size-7 items-center justify-center rounded-md sm:size-8",
        active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
      )}>
        {icon}
      </div>
      <div>
        <div className={cn("text-sm font-medium", active && "text-primary")}>{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
    </button>
  );
}

function TaskCardSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="flex items-start gap-3 rounded-lg border p-4"
        >
          <div className="size-7 animate-pulse rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-full animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}
