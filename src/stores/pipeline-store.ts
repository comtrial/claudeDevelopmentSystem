import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { PipelineSummary, LatestSession } from "@/types/pipeline-summary";
import type { Task, TaskStatus } from "@/types/pipeline";

// ─── Dashboard store slice (pipeline list) ─────────────────────────────────

interface PipelineListState {
  pipelines: PipelineSummary[];
  isLoading: boolean;
  error: string | null;
}

interface PipelineListActions {
  setPipelines: (pipelines: PipelineSummary[]) => void;
  updatePipeline: (id: string, updates: Partial<Pick<PipelineSummary, "status" | "title" | "description" | "updated_at">>) => void;
  updateSession: (pipelineId: string, session: LatestSession) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
}

// ─── Monitoring store slice (active pipeline detail) ───────────────────────

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export interface ActiveAgent {
  id: string;
  name: string;
  role: "coder" | "reviewer" | "planner" | "tester" | "pm" | "engineer";
  status: "active" | "idle" | "completed" | "error";
  currentTask: string | null;
  progress: number;
  tokensUsed: number;
  tokenBudget: number;
  lastActivity: string;
}

export interface ActiveLog {
  id: string | number;
  session_id: string;
  agent_role: string;
  level: "info" | "warn" | "error" | "debug" | "system";
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface MonitoringState {
  activePipeline: Record<string, unknown> | null;
  agents: ActiveAgent[];
  tasks: Task[];
  logs: ActiveLog[];
  connectionStatus: ConnectionStatus;
  activeSessionId: string | null;
}

interface MonitoringActions {
  setActivePipeline: (pipeline: Record<string, unknown> | null) => void;
  setAgents: (agents: ActiveAgent[]) => void;
  setTasks: (tasks: Task[]) => void;
  updateTaskStatus: (taskId: string, status: TaskStatus, outputData?: Record<string, unknown>) => void;
  updatePipelineStatus: (pipeline: Record<string, unknown>) => void;
  updateAgentStatus: (agent: Partial<ActiveAgent> & { id: string }) => void;
  appendLog: (log: ActiveLog) => void;
  clearLogs: () => void;
  setActiveSessionId: (id: string | null) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  reset: () => void;
}

// ─── Combined store ────────────────────────────────────────────────────────

type PipelineStore = PipelineListState & PipelineListActions & MonitoringState & MonitoringActions;

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

const MAX_LOG_BUFFER = 2000; // cap in-memory logs

export const usePipelineStore = create<PipelineStore>()(
  devtools(
    (set) => ({
      // ── List state
      pipelines: [],
      isLoading: false,
      error: null,

      // ── Monitoring state
      activePipeline: null,
      agents: [],
      tasks: [],
      logs: [],
      connectionStatus: "disconnected",
      activeSessionId: null,

      // ── List actions
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

      // ── Monitoring actions
      setActivePipeline: (pipeline) => {
        set({ activePipeline: pipeline }, false, "setActivePipeline");
      },

      setAgents: (agents) => {
        set({ agents }, false, "setAgents");
      },

      setTasks: (tasks) => {
        set({ tasks }, false, "setTasks");
      },

      updateTaskStatus: (taskId, status, outputData) => {
        set(
          (state) => ({
            tasks: state.tasks.map((t) =>
              t.id === taskId
                ? { ...t, status, ...(outputData ? { output_data: outputData } : {}), updated_at: new Date().toISOString() }
                : t
            ),
          }),
          false,
          "updateTaskStatus"
        );
      },

      updatePipelineStatus: (pipeline) => {
        set(
          (state) => ({
            activePipeline: state.activePipeline
              ? { ...state.activePipeline, ...pipeline }
              : pipeline,
          }),
          false,
          "updatePipelineStatus"
        );
      },

      updateAgentStatus: (agent) => {
        set(
          (state) => ({
            agents: state.agents.map((a) =>
              a.id === agent.id ? { ...a, ...agent } : a
            ),
          }),
          false,
          "updateAgentStatus"
        );
      },

      appendLog: (log) => {
        set(
          (state) => {
            // Deduplicate by id
            if (state.logs.some((l) => l.id === log.id)) return state;
            const next = [...state.logs, log];
            // Keep buffer bounded
            return { logs: next.length > MAX_LOG_BUFFER ? next.slice(-MAX_LOG_BUFFER) : next };
          },
          false,
          "appendLog"
        );
      },

      clearLogs: () => {
        set({ logs: [] }, false, "clearLogs");
      },

      setActiveSessionId: (activeSessionId) => {
        set({ activeSessionId }, false, "setActiveSessionId");
      },

      setConnectionStatus: (connectionStatus) => {
        set({ connectionStatus }, false, "setConnectionStatus");
      },

      reset: () => {
        set(
          { activePipeline: null, agents: [], tasks: [], logs: [], connectionStatus: "disconnected", activeSessionId: null },
          false,
          "reset"
        );
      },
    }),
    { name: "pipeline-store", enabled: process.env.NODE_ENV === "development" }
  )
);

// ── Selectors ──────────────────────────────────────────────────────────────
export const selectPipelines = (state: PipelineStore) => state.pipelines;
export const selectIsLoading = (state: PipelineStore) => state.isLoading;
export const selectError = (state: PipelineStore) => state.error;
export const selectPipelineById = (id: string) => (state: PipelineStore) =>
  state.pipelines.find((p) => p.id === id) ?? null;
export const selectRunningPipelines = (state: PipelineStore) =>
  state.pipelines.filter((p) => p.status === "running");
export const selectActivePipeline = (state: PipelineStore) => state.activePipeline;
export const selectAgents = (state: PipelineStore) => state.agents;
export const selectTasks = (state: PipelineStore) => state.tasks;
export const selectLogs = (state: PipelineStore) => state.logs;
export const selectConnectionStatus = (state: PipelineStore) => state.connectionStatus;
export const selectActiveSessionId = (state: PipelineStore) => state.activeSessionId;
