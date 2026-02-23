import type { PipelineStatus, PipelineMode } from "./pipeline";

export interface AgentSummary {
  total: number;
  roles: string[];
}

export interface LatestSession {
  id: string;
  status: string;
  token_usage: number;
  token_limit: number;
  progress_percent: number;
}

export interface PipelineSummary {
  id: string;
  title: string;
  description: string | null;
  status: PipelineStatus;
  mode: PipelineMode;
  created_at: string;
  updated_at: string;
  agent_summary: AgentSummary;
  latest_session: LatestSession | null;
}
