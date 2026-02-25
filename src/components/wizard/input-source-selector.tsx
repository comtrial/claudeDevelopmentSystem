"use client";

import { PenLine, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface InputSourceSelectorProps {
  value: "direct" | "notion";
  onChange: (source: "direct" | "notion") => void;
}

export function InputSourceSelector({ value, onChange }: InputSourceSelectorProps) {
  return (
    <div className="flex gap-2">
      <SourceTab
        active={value === "direct"}
        onClick={() => onChange("direct")}
        icon={<PenLine className="size-4" />}
        label="직접 입력"
        description="텍스트로 작업 설명"
      />
      <SourceTab
        active={value === "notion"}
        onClick={() => onChange("notion")}
        icon={<BookOpen className="size-4" />}
        label="Notion 문서"
        description="Notion 페이지에서 가져오기"
      />
    </div>
  );
}

function SourceTab({
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
