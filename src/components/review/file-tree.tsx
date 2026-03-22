"use client";

import { cn } from "@/lib/utils";
import { FilePlus, FileMinus, FileEdit, CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";

export interface FileChange {
  id: string;
  file_path: string;
  change_type: "added" | "modified" | "deleted" | "renamed";
  additions: number;
  deletions: number;
  review_status: "pending" | "approved" | "rejected" | "changes_requested";
}

interface FileTreeProps {
  changes: FileChange[];
  activeChangeId: string | null;
  onSelect: (changeId: string) => void;
}

const changeTypeIcon = {
  added: <FilePlus className="h-3.5 w-3.5 text-green-500 shrink-0" />,
  modified: <FileEdit className="h-3.5 w-3.5 text-yellow-500 shrink-0" />,
  deleted: <FileMinus className="h-3.5 w-3.5 text-red-500 shrink-0" />,
  renamed: <FileEdit className="h-3.5 w-3.5 text-blue-500 shrink-0" />,
};

const reviewStatusConfig = {
  pending: { icon: <Clock className="h-3 w-3" />, label: "대기", className: "bg-muted text-muted-foreground" },
  approved: { icon: <CheckCircle2 className="h-3 w-3" />, label: "승인", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  rejected: { icon: <XCircle className="h-3 w-3" />, label: "거절", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  changes_requested: { icon: <AlertCircle className="h-3 w-3" />, label: "수정요청", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
};

function shortenPath(path: string): string {
  const parts = path.split("/");
  if (parts.length <= 3) return path;
  return `.../${parts.slice(-2).join("/")}`;
}

export function FileTree({ changes, activeChangeId, onSelect }: FileTreeProps) {
  return (
    <div className="space-y-0.5">
      {changes.map((change) => {
        const statusConf = reviewStatusConfig[change.review_status] ?? reviewStatusConfig.pending;
        const isActive = change.id === activeChangeId;

        return (
          <button
            key={change.id}
            onClick={() => onSelect(change.id)}
            className={cn(
              "w-full text-left px-3 py-2 rounded-md text-sm flex items-start gap-2 transition-colors group",
              isActive
                ? "bg-accent text-accent-foreground"
                : "hover:bg-accent/50"
            )}
          >
            {/* 파일 타입 아이콘 */}
            <span className="mt-0.5">{changeTypeIcon[change.change_type]}</span>

            {/* 파일 경로 */}
            <span className="flex-1 min-w-0">
              <span className="block truncate font-mono text-xs leading-relaxed" title={change.file_path}>
                {shortenPath(change.file_path)}
              </span>
              <span className="flex items-center gap-1.5 mt-0.5">
                {change.additions > 0 && (
                  <span className="text-green-600 dark:text-green-400 text-xs">+{change.additions}</span>
                )}
                {change.deletions > 0 && (
                  <span className="text-red-600 dark:text-red-400 text-xs">-{change.deletions}</span>
                )}
              </span>
            </span>

            {/* 리뷰 상태 배지 */}
            <span
              className={cn(
                "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium shrink-0",
                statusConf.className
              )}
            >
              {statusConf.icon}
              <span className="hidden sm:inline">{statusConf.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
