"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface FollowUpInputProps {
  pipelineId: string;
  disabled?: boolean;
  onSubmit: (sessionId: string) => void;
}

const MIN_LENGTH = 10;

export function FollowUpInput({ pipelineId, disabled, onSubmit }: FollowUpInputProps) {
  const [prompt, setPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isValid = prompt.trim().length >= MIN_LENGTH;

  const handleSubmit = async () => {
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/pipelines/${pipelineId}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ follow_up_prompt: prompt.trim() }),
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        toast.error(json.error?.message ?? "후속 질의 실행에 실패했습니다.");
        return;
      }

      const newSessionId = json.data?.session?.id;
      if (newSessionId) {
        setPrompt("");
        toast.success("후속 질의가 실행되었습니다.");
        onSubmit(newSessionId);
      }
    } catch {
      toast.error("네트워크 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex items-end gap-2 w-full">
      <div className="flex-1 space-y-1">
        <Textarea
          placeholder="후속 질의를 입력하세요..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={disabled || isSubmitting}
          rows={2}
          className="resize-none min-h-[60px] max-h-[150px] text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && isValid) {
              handleSubmit();
            }
          }}
        />
        {prompt.length > 0 && !isValid && (
          <p className="text-xs text-muted-foreground">
            최소 {MIN_LENGTH}자 이상 입력해 주세요. ({prompt.trim().length}/{MIN_LENGTH})
          </p>
        )}
      </div>
      <Button
        size="sm"
        disabled={!isValid || isSubmitting || disabled}
        onClick={handleSubmit}
      >
        {isSubmitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        <span className="ml-1.5 hidden sm:inline">후속 실행</span>
      </Button>
    </div>
  );
}
