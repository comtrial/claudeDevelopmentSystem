import type { Timestamp } from "./api";
import type { PipelineMode } from "./pipeline";
import type { AgentRole } from "./agent";

export interface TemplateAgentConfig {
  role: AgentRole;
  instruction?: string;
  model?: string;
}

export interface TemplateConfig {
  agents: TemplateAgentConfig[];
  mode: PipelineMode;
}

export interface PresetTemplate {
  id: string;
  title: string;
  description: string | null;
  icon: string;
  config: TemplateConfig;
  is_preset: boolean;
  user_id: string | null;
  created_at: Timestamp;
}

export interface TemplatesResponse {
  presets: PresetTemplate[];
  custom: PresetTemplate[];
}
