"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  GitBranch,
  FileJson,
  FileText,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useWizardStore } from "@/stores/wizard-store";
import { cn } from "@/lib/utils";
import type { ApiResponse } from "@/types/api";

interface ProjectEntry {
  name: string;
  path: string;
  indicators: { hasPackageJson: boolean; hasClaudeMd: boolean; hasGit: boolean };
}

interface ProjectListResult {
  baseDir: string;
  projects: ProjectEntry[];
}

interface ValidationResult {
  exists: boolean;
  name: string;
  reason: string | null;
  indicators?: { hasPackageJson: boolean; hasClaudeMd: boolean; hasGit: boolean };
}

type ValidationState = "idle" | "validating" | "valid" | "invalid";

const RECENT_PATHS_KEY = "cds:recent-working-dirs";
const MAX_RECENT = 5;

function getRecentPaths(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_PATHS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveRecentPath(path: string) {
  try {
    const existing = getRecentPaths();
    const updated = [path, ...existing.filter((p) => p !== path)].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_PATHS_KEY, JSON.stringify(updated));
  } catch {
    // localStorage unavailable
  }
}

export function WorkingDirInput() {
  const workingDir = useWizardStore((s) => s.workingDir);
  const category = useWizardStore((s) => s.category);
  const setWorkingDir = useWizardStore((s) => s.setWorkingDir);

  const [validationState, setValidationState] = useState<ValidationState>("idle");
  const [dirName, setDirName] = useState("");
  const [errorReason, setErrorReason] = useState("");
  const [projects, setProjects] = useState<ProjectEntry[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const projectsLoaded = useRef(false);

  const isVisible = category === "development";

  // Load project list when component becomes visible
  const loadProjects = useCallback(async () => {
    if (projectsLoaded.current) return;
    try {
      const res = await fetch("/api/validate-path");
      const json: ApiResponse<ProjectListResult> = await res.json();
      if (json.data?.projects) {
        setProjects(json.data.projects);
      }
      projectsLoaded.current = true;
    } catch {
      // Network error — leave empty
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  useEffect(() => {
    if (isVisible) {
      loadProjects();
    }
  }, [isVisible, loadProjects]);

  const validatePath = useCallback(async (path: string) => {
    if (!path.trim()) {
      setValidationState("idle");
      setDirName("");
      setErrorReason("");
      return;
    }

    if (!path.startsWith("/")) {
      setValidationState("invalid");
      setErrorReason("절대 경로를 입력해주세요. (/ 로 시작)");
      return;
    }

    setValidationState("validating");

    try {
      const res = await fetch("/api/validate-path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: path.trim() }),
      });

      const json: ApiResponse<ValidationResult> = await res.json();

      if (json.data?.exists) {
        setValidationState("valid");
        setDirName(json.data.name);
        setErrorReason("");
      } else {
        setValidationState("invalid");
        const reason = json.data?.reason;
        if (reason === "not_found") {
          setErrorReason("디렉토리가 존재하지 않습니다.");
        } else if (reason === "not_directory") {
          setErrorReason("파일이 아닌 디렉토리를 지정해주세요.");
        } else {
          setErrorReason("유효한 디렉토리 경로를 입력해주세요.");
        }
      }
    } catch {
      setValidationState("invalid");
      setErrorReason("경로 확인 중 오류가 발생했습니다.");
    }
  }, []);

  const handleChange = useCallback(
    (value: string) => {
      setWorkingDir(value);
      setValidationState("idle");

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        validatePath(value);
      }, 500);
    },
    [setWorkingDir, validatePath]
  );

  const handleBlur = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (workingDir.trim()) {
      validatePath(workingDir);
    }
  }, [workingDir, validatePath]);

  const handleSelectProject = useCallback(
    (path: string) => {
      setWorkingDir(path);
      setValidationState("valid");
      setDirName(path.split("/").pop() ?? "");
      setErrorReason("");
    },
    [setWorkingDir]
  );

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="overflow-hidden"
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-1.5">
              <Label className="text-sm font-medium">프로젝트 디렉토리</Label>
              <Badge variant="destructive" className="px-1 py-0 text-[10px]">
                필수
              </Badge>
            </div>

            {/* Project cards */}
            {loadingProjects ? (
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-lg border bg-muted" />
                ))}
              </div>
            ) : projects.length > 0 ? (
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                {projects.map((project) => {
                  const isSelected = workingDir === project.path;
                  return (
                    <button
                      key={project.path}
                      type="button"
                      onClick={() => handleSelectProject(project.path)}
                      className={cn(
                        "flex items-start gap-2 rounded-lg border p-2 text-left transition-all sm:gap-3 sm:p-3",
                        isSelected
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "hover:border-muted-foreground/30"
                      )}
                    >
                      <div className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-md sm:size-8",
                        isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      )}>
                        <FolderOpen className="size-3.5 sm:size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={cn(
                          "text-sm font-medium truncate",
                          isSelected && "text-primary"
                        )}>
                          {project.name}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          {project.indicators.hasGit && (
                            <GitBranch className="size-3 text-muted-foreground" />
                          )}
                          {project.indicators.hasPackageJson && (
                            <FileJson className="size-3 text-muted-foreground" />
                          )}
                          {project.indicators.hasClaudeMd && (
                            <FileText className="size-3 text-amber-500" />
                          )}
                        </div>
                      </div>
                      {isSelected && (
                        <CheckCircle2 className="size-4 shrink-0 text-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {/* Manual path input */}
            <div className="flex flex-col gap-1.5">
              <p className="text-xs text-muted-foreground">
                또는 직접 경로 입력
              </p>
              <div className="relative">
                <FolderOpen className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={workingDir}
                  onChange={(e) => handleChange(e.target.value)}
                  onBlur={handleBlur}
                  placeholder="/Users/username/my-project"
                  className="pl-9 font-mono text-sm"
                />
              </div>
            </div>

            {/* Validation feedback */}
            <AnimatePresence mode="wait">
              {validationState === "validating" && (
                <motion.p
                  key="validating"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-1 text-xs text-muted-foreground"
                >
                  <span className="size-3 animate-spin rounded-full border border-current border-t-transparent" />
                  경로 확인 중...
                </motion.p>
              )}
              {validationState === "valid" && (
                <motion.p
                  key="valid"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-1 text-xs text-emerald-600"
                >
                  <CheckCircle2 className="size-3" />
                  {dirName} — 디렉토리 확인됨
                </motion.p>
              )}
              {validationState === "invalid" && (
                <motion.p
                  key="invalid"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-1 text-xs text-destructive"
                >
                  <AlertCircle className="size-3" />
                  {errorReason}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
