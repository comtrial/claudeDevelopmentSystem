import type { Timestamp } from "./api";

export type AgentRole = "pm" | "engineer" | "reviewer";

export interface Agent {
  id: string;
  pipeline_id: string;
  role: AgentRole;
  instruction: string | null;
  model: string;
  config: Record<string, unknown>;
  created_at: Timestamp;
}

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface AgentLog {
  id: number;
  session_id: string;
  agent_role: string;
  level: LogLevel;
  message: string;
  metadata: Record<string, unknown>;
  created_at: Timestamp;
}
