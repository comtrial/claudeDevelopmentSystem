"use client";

import { useState, useCallback } from "react";
import { Loader2, Wand2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useWizardStore } from "@/stores/wizard-store";
import type { ParsedTask, Recommendation } from "@/types/wizard";
import type { ApiResponse } from "@/types/api";
import { TaskCardList } from "./task-card-list";
import { RecommendationBanner } from "./recommendation-banner";

const MAX_LENGTH = 2000;
const TIMEOUT_MS = 30_000;

interface ParseResult {
  tasks: ParsedTask[];
  recommendation: Recommendation;
}

export function StepTaskInput() {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setTasks = useWizardStore((s) => s.setTasks);
  const setRecommendation = useWizardStore((s) => s.setRecommendation);

  const handleParse = useCallback(async () => {
    if (!input.trim()) return;

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
  }, [input, setTasks, setRecommendation]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>작업 정의</CardTitle>
        <CardDescription>
          파이프라인에서 수행할 작업을 자연어로 입력하세요.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="어떤 작업을 자동화하고 싶으신가요?"
            maxLength={MAX_LENGTH}
            rows={4}
            disabled={isLoading}
            className="w-full resize-none rounded-lg border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
          />
          <span className="absolute bottom-2 right-3 text-[10px] text-muted-foreground">
            {input.length}/{MAX_LENGTH}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={handleParse}
            disabled={isLoading || !input.trim()}
            size="sm"
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
