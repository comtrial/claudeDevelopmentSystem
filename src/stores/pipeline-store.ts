import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { PipelineSummary, LatestSession } from "@/types/pipeline-summary";

interface PipelineState {
  pipelines: PipelineSummary[];
  isLoading: boolean;
  error: string | null;
}

interface PipelineActions {
  setPipelines: (pipelines: PipelineSummary[]) => void;
  updatePipeline: (id: string, updates: Partial<Pick<PipelineSummary, "status" | "title" | "description" | "updated_at">>) => void;
  updateSession: (pipelineId: string, session: LatestSession) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
}

type PipelineStore = PipelineState & PipelineActions;

const STATUS_SORT_ORDER: Record<string, number> = {
  running: 0,
  paused: 1,
  draft: 2,
  failed: 3,
  completed: 4,
  cancelled: 5,
};

function sortPipelines(pipelines: PipelineSummary[]): PipelineSummary[] {
  return [...pipelines].sort((a, b) => {
    const orderA = STATUS_SORT_ORDER[a.status] ?? 99;
    const orderB = STATUS_SORT_ORDER[b.status] ?? 99;
    if (orderA !== orderB) return orderA - orderB;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
}

export const usePipelineStore = create<PipelineStore>()(
  devtools(
    (set) => ({
      pipelines: [],
      isLoading: false,
      error: null,

      setPipelines: (pipelines) => {
        set({ pipelines: sortPipelines(pipelines), error: null }, false, "setPipelines");
      },

      updatePipeline: (id, updates) => {
        set(
          (state) => {
            const next = state.pipelines.map((p) =>
              p.id === id ? { ...p, ...updates } : p
            );
            return { pipelines: sortPipelines(next) };
          },
          false,
          "updatePipeline"
        );
      },

      updateSession: (pipelineId, session) => {
        set(
          (state) => {
            const next = state.pipelines.map((p) =>
              p.id === pipelineId ? { ...p, latest_session: session } : p
            );
            return { pipelines: next };
          },
          false,
          "updateSession"
        );
      },

      setLoading: (isLoading) => {
        set({ isLoading }, false, "setLoading");
      },

      setError: (error) => {
        set({ error }, false, "setError");
      },
    }),
    { name: "pipeline-store", enabled: process.env.NODE_ENV === "development" }
  )
);

// Selectors
export const selectPipelines = (state: PipelineStore) => state.pipelines;
export const selectIsLoading = (state: PipelineStore) => state.isLoading;
export const selectError = (state: PipelineStore) => state.error;
export const selectPipelineById = (id: string) => (state: PipelineStore) =>
  state.pipelines.find((p) => p.id === id) ?? null;
export const selectRunningPipelines = (state: PipelineStore) =>
  state.pipelines.filter((p) => p.status === "running");
