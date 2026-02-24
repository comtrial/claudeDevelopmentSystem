"use client";

import { useState, useCallback } from "react";
import { Loader2, Wand2, Code, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useWizardStore } from "@/stores/wizard-store";
import type { ParsedTask, ParseAnalysis, Recommendation, PipelineCategoryType } from "@/types/wizard";
import type { ApiResponse } from "@/types/api";
import { cn } from "@/lib/utils";
import { TaskCardList } from "./task-card-list";
import { RecommendationBanner } from "./recommendation-banner";

const MIN_LENGTH = 10;
const MAX_LENGTH = 2000;
const TIMEOUT_MS = 200_000; // 200s — CLI timeout (180s) + network margin

interface ParseResult {
  analysis?: ParseAnalysis;
  tasks: ParsedTask[];
  recommendation: Recommendation;
}

export function StepTaskInput() {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const category = useWizardStore((s) => s.category);
  const setCategory = useWizardStore((s) => s.setCategory);
  const setTasks = useWizardStore((s) => s.setTasks);
  const setRecommendation = useWizardStore((s) => s.setRecommendation);
  const setAnalysis = useWizardStore((s) => s.setAnalysis);
  const setOriginalQuery = useWizardStore((s) => s.setOriginalQuery);

  const trimmed = input.trim();
  const isTooShort = trimmed.length > 0 && trimmed.length < MIN_LENGTH;

  const handleParse = useCallback(async () => {
    if (!input.trim() || input.trim().length < MIN_LENGTH) return;

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
  }, [input, setTasks, setRecommendation, setAnalysis]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>작업 정의</CardTitle>
        <CardDescription>
          파이프라인에서 수행할 작업을 자연어로 입력하세요.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
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

        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={category === "development"
              ? "어떤 개발 작업을 자동화하고 싶으신가요?"
              : "어떤 작업을 수행하고 싶으신가요? (분석, 문서 작성, 리서치 등)"
            }
            maxLength={MAX_LENGTH}
            rows={4}
            disabled={isLoading}
            className="w-full resize-none rounded-lg border bg-background px-4 py-3 text-base sm:text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
          />
          <span className="absolute bottom-2 right-3 text-[10px] text-muted-foreground">
            {input.length}/{MAX_LENGTH}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={handleParse}
            disabled={isLoading || !trimmed || isTooShort}
            size="sm"
            className="min-h-[44px] sm:min-h-0"
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin" />
                분석 중...
              </>
            ) : (
              <>
                <Wand2 />
                분석
              </>
            )}
          </Button>
          {isTooShort && (
            <p className="text-xs text-muted-foreground">
              최소 {MIN_LENGTH}자 이상 입력해주세요. ({trimmed.length}/{MIN_LENGTH})
            </p>
          )}
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
        </div>

        <RecommendationBanner />

        {isLoading ? <TaskCardSkeleton /> : <TaskCardList />}
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
        "flex flex-1 items-center gap-3 rounded-lg border p-3 text-left transition-colors",
        active
          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
          : "border-border hover:border-muted-foreground/30"
      )}
    >
      <div className={cn(
        "flex size-8 items-center justify-center rounded-md",
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
