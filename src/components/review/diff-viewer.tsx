"use client";

import { useState, useCallback } from "react";
import { parsePatch } from "diff";
import { cn } from "@/lib/utils";
import { MessageSquare } from "lucide-react";

export interface DiffViewerChange {
  id: string;
  file_path: string;
  change_type: "added" | "modified" | "deleted";
  diff_content: string;
  old_content: string | null;
  new_content: string;
  review_status: string;
}

interface DiffViewerProps {
  change: DiffViewerChange;
  mode: "unified" | "split";
  onLineComment: (lineNumber: number) => void;
}

interface DiffLine {
  type: "added" | "removed" | "context" | "header";
  content: string;
  oldLineNo: number | null;
  newLineNo: number | null;
}

function parseDiffContent(diffContent: string): DiffLine[] {
  const lines: DiffLine[] = [];

  try {
    const patches = parsePatch(diffContent);
    if (!patches || patches.length === 0) {
      // Raw content fallback — treat all as context lines
      return diffContent.split("\n").map((content, i) => ({
        type: "context" as const,
        content,
        oldLineNo: i + 1,
        newLineNo: i + 1,
      }));
    }

    for (const patch of patches) {
      for (const hunk of patch.hunks) {
        // Hunk header
        lines.push({
          type: "header",
          content: `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`,
          oldLineNo: null,
          newLineNo: null,
        });

        let oldLineNo = hunk.oldStart;
        let newLineNo = hunk.newStart;

        for (const line of hunk.lines) {
          if (line.startsWith("+")) {
            lines.push({ type: "added", content: line.slice(1), oldLineNo: null, newLineNo: newLineNo++ });
          } else if (line.startsWith("-")) {
            lines.push({ type: "removed", content: line.slice(1), oldLineNo: oldLineNo++, newLineNo: null });
          } else {
            // context line (starts with " ")
            lines.push({ type: "context", content: line.slice(1), oldLineNo: oldLineNo++, newLineNo: newLineNo++ });
          }
        }
      }
    }
  } catch {
    // If parse fails, show raw lines
    return diffContent.split("\n").map((content, i) => ({
      type: "context" as const,
      content,
      oldLineNo: i + 1,
      newLineNo: i + 1,
    }));
  }

  return lines;
}

function getLanguage(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescript",
    js: "javascript", jsx: "javascript",
    sql: "sql", json: "json",
    css: "css", scss: "css",
    md: "markdown", py: "python",
  };
  return map[ext] ?? "text";
}

// Simple syntax highlight using regex-based colorization (avoids async shiki loading issues)
function tokenizeLine(content: string, lang: string): string {
  if (!content) return "&nbsp;";

  // Escape HTML
  const escaped = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  if (lang === "typescript" || lang === "javascript") {
    return escaped
      .replace(
        /\b(const|let|var|function|return|import|export|from|default|class|extends|implements|interface|type|enum|if|else|for|while|do|switch|case|break|continue|new|typeof|instanceof|async|await|void|null|undefined|true|false)\b/g,
        '<span class="text-purple-600 dark:text-purple-400">$1</span>'
      )
      .replace(/(".*?"|'.*?'|`.*?`)/g, '<span class="text-green-600 dark:text-green-400">$1</span>')
      .replace(/(\/\/.*$)/g, '<span class="text-gray-400 dark:text-gray-500 italic">$1</span>');
  }

  if (lang === "sql") {
    return escaped.replace(
      /\b(SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP BY|ORDER BY|HAVING|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TABLE|INDEX|VIEW|AS|AND|OR|NOT|IN|IS|NULL|LIKE|BETWEEN|LIMIT|OFFSET)\b/gi,
      '<span class="text-blue-600 dark:text-blue-400 font-medium">$1</span>'
    );
  }

  return escaped;
}

function LineNumber({ n }: { n: number | null }) {
  return (
    <span className="select-none text-right pr-3 pl-2 text-muted-foreground/50 text-xs w-10 shrink-0 inline-block">
      {n ?? ""}
    </span>
  );
}

interface DiffLineRowProps {
  line: DiffLine;
  lang: string;
  onComment: (lineNo: number) => void;
}

function DiffLineRow({ line, lang, onComment }: DiffLineRowProps) {
  const [hovered, setHovered] = useState(false);

  const bgClass =
    line.type === "header"
      ? "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300"
      : line.type === "added"
        ? "bg-green-50 dark:bg-green-950/30"
        : line.type === "removed"
          ? "bg-red-50 dark:bg-red-950/30"
          : "";

  const prefixChar =
    line.type === "added" ? "+" : line.type === "removed" ? "-" : line.type === "header" ? "" : " ";

  const prefixColor =
    line.type === "added"
      ? "text-green-600 dark:text-green-400"
      : line.type === "removed"
        ? "text-red-600 dark:text-red-400"
        : "text-muted-foreground/30";

  const lineNo = line.newLineNo ?? line.oldLineNo;

  return (
    <tr
      className={cn("group", bgClass)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {line.type === "header" ? (
        <td colSpan={4} className="px-3 py-0.5 font-mono text-xs">
          {line.content}
        </td>
      ) : (
        <>
          <LineNumber n={line.oldLineNo} />
          <LineNumber n={line.newLineNo} />
          <td className={cn("px-1 select-none text-xs font-mono w-4 shrink-0", prefixColor)}>
            {prefixChar}
          </td>
          <td className="px-1 py-0.5 font-mono text-xs whitespace-pre w-full relative">
            <span
              dangerouslySetInnerHTML={{ __html: tokenizeLine(line.content, lang) }}
            />
            {/* 댓글 버튼 (hover 시 표시) */}
            {hovered && lineNo !== null && (
              <button
                onClick={() => onComment(lineNo)}
                className="absolute right-2 top-0 bottom-0 my-auto h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                title="이 라인에 댓글 달기"
              >
                <MessageSquare className="h-3.5 w-3.5" />
              </button>
            )}
          </td>
        </>
      )}
    </tr>
  );
}

// Split view: show old content on left, new content on right
function SplitDiffView({
  lines,
  lang,
  onComment,
}: {
  lines: DiffLine[];
  lang: string;
  onComment: (n: number) => void;
}) {
  // Pair removed lines with added lines for side-by-side display
  const pairs: Array<{ left: DiffLine | null; right: DiffLine | null }> = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.type === "header") {
      pairs.push({ left: line, right: null });
      i++;
    } else if (line.type === "removed") {
      // Look ahead for matching added line
      const next = lines[i + 1];
      if (next && next.type === "added") {
        pairs.push({ left: line, right: next });
        i += 2;
      } else {
        pairs.push({ left: line, right: null });
        i++;
      }
    } else if (line.type === "added") {
      pairs.push({ left: null, right: line });
      i++;
    } else {
      pairs.push({ left: line, right: line });
      i++;
    }
  }

  return (
    <div className="grid grid-cols-2 divide-x divide-border">
      {/* Old (left) */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <tbody>
            {pairs.map((pair, idx) => {
              const line = pair.left;
              if (!line) {
                return <tr key={idx} className="bg-muted/20"><td colSpan={3} className="py-0.5">&nbsp;</td></tr>;
              }
              if (line.type === "header") {
                return (
                  <tr key={idx} className="bg-blue-50 dark:bg-blue-950/30">
                    <td colSpan={3} className="px-3 py-0.5 font-mono text-xs text-blue-700 dark:text-blue-300">
                      {line.content}
                    </td>
                  </tr>
                );
              }
              const bg = line.type === "removed" ? "bg-red-50 dark:bg-red-950/30" : "";
              return (
                <tr key={idx} className={bg}>
                  <LineNumber n={line.oldLineNo} />
                  <td className={cn("px-1 select-none font-mono w-4", line.type === "removed" ? "text-red-500" : "text-muted-foreground/30")}>
                    {line.type === "removed" ? "-" : " "}
                  </td>
                  <td className="px-1 py-0.5 font-mono whitespace-pre w-full">
                    <span dangerouslySetInnerHTML={{ __html: tokenizeLine(line.content, lang) }} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* New (right) */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <tbody>
            {pairs.map((pair, idx) => {
              const line = pair.right;
              if (!line) {
                return <tr key={idx} className="bg-muted/20"><td colSpan={3} className="py-0.5">&nbsp;</td></tr>;
              }
              if (line.type === "header") {
                return (
                  <tr key={idx} className="bg-blue-50 dark:bg-blue-950/30">
                    <td colSpan={3} className="px-3 py-0.5 font-mono text-xs text-blue-700 dark:text-blue-300">
                      {line.content}
                    </td>
                  </tr>
                );
              }
              const bg = line.type === "added" ? "bg-green-50 dark:bg-green-950/30" : "";
              const lineNo = line.newLineNo ?? line.oldLineNo;
              return (
                <tr key={idx} className={cn("group", bg)}>
                  <LineNumber n={line.newLineNo} />
                  <td className={cn("px-1 select-none font-mono w-4", line.type === "added" ? "text-green-500" : "text-muted-foreground/30")}>
                    {line.type === "added" ? "+" : " "}
                  </td>
                  <td className="px-1 py-0.5 font-mono whitespace-pre w-full relative">
                    <span dangerouslySetInnerHTML={{ __html: tokenizeLine(line.content, lang) }} />
                    {lineNo !== null && (
                      <button
                        onClick={() => onComment(lineNo)}
                        className="absolute right-2 top-0 bottom-0 my-auto h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                        title="이 라인에 댓글 달기"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DiffViewer({ change, mode, onLineComment }: DiffViewerProps) {
  const lang = getLanguage(change.file_path);
  const lines = parseDiffContent(change.diff_content);

  const handleComment = useCallback(
    (lineNo: number) => onLineComment(lineNo),
    [onLineComment]
  );

  if (mode === "split") {
    return (
      <div className="rounded-b-md border-t overflow-auto max-h-[600px] bg-background">
        <SplitDiffView lines={lines} lang={lang} onComment={handleComment} />
      </div>
    );
  }

  // Unified view
  return (
    <div className="rounded-b-md border-t overflow-auto max-h-[600px] bg-background">
      <table className="w-full border-collapse">
        <tbody>
          {lines.map((line, idx) => (
            <DiffLineRow key={idx} line={line} lang={lang} onComment={handleComment} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
