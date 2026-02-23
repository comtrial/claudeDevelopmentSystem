import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { Pipeline, PipelineStatus } from "@/types/pipeline";

interface PipelineStore {
  activePipelines: Pipeline[];
  currentPipeline: Pipeline | null;
  setActivePipelines: (pipelines: Pipeline[]) => void;
  setCurrentPipeline: (pipeline: Pipeline | null) => void;
  updatePipelineStatus: (id: string, status: PipelineStatus) => void;
  addPipeline: (pipeline: Pipeline) => void;
  removePipeline: (id: string) => void;
}

export const usePipelineStore = create<PipelineStore>()(
  devtools(
    (set) => ({
      activePipelines: [],
      currentPipeline: null,
      setActivePipelines: (pipelines) => set({ activePipelines: pipelines }),
      setCurrentPipeline: (pipeline) => set({ currentPipeline: pipeline }),
      updatePipelineStatus: (id, status) =>
        set((state) => ({
          activePipelines: state.activePipelines.map((p) =>
            p.id === id ? { ...p, status } : p
          ),
        })),
      addPipeline: (pipeline) =>
        set((state) => ({
          activePipelines: [...state.activePipelines, pipeline],
        })),
      removePipeline: (id) =>
        set((state) => ({
          activePipelines: state.activePipelines.filter((p) => p.id !== id),
        })),
    }),
    { name: "pipeline-store", enabled: process.env.NODE_ENV === "development" }
  )
);
