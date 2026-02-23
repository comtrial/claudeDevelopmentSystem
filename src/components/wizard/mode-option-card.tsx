"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModeOptionCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  badge?: string;
  selected: boolean;
  onClick: () => void;
}

export function ModeOptionCard({
  icon: Icon,
  title,
  description,
  badge,
  selected,
  onClick,
}: ModeOptionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-all",
        selected
          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
          : "hover:border-border-strong/50"
      )}
    >
      <div className="flex w-full items-center gap-2">
        <Icon className={cn("size-5", selected ? "text-primary" : "text-muted-foreground")} />
        <span className="text-sm font-semibold">{title}</span>
        {badge && (
          <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
            {badge}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </button>
  );
}
