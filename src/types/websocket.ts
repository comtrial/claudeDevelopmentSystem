import type { PipelineStatus } from "./pipeline";

export interface WebSocketMessage {
  type: "pipeline_status" | "agent_log" | "session_progress";
  payload: unknown;
}

export interface PipelineEvent {
  pipelineId: string;
  status: PipelineStatus;
  updatedAt: string;
}

export interface AgentLogEvent {
  sessionId: string;
  agentRole: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  createdAt: string;
}

export interface SessionProgressEvent {
  sessionId: string;
  pipelineId: string;
  progress: number;
  currentTask: string | null;
  updatedAt: string;
}
