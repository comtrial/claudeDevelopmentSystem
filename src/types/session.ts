import type { Timestamp } from "./api";

export type SessionStatus =
  | "initializing"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export interface Session {
  id: string;
  pipeline_id: string;
  status: SessionStatus;
  token_usage: number;
  token_limit: number;
  started_at: Timestamp;
  completed_at: Timestamp | null;
  metadata: Record<string, unknown>;
  follow_up_prompt: string | null;
  parent_session_id: string | null;
  session_number: number;
}

export interface SessionSummary {
  id: string;
  status: SessionStatus;
  session_number: number;
  follow_up_prompt: string | null;
  started_at: Timestamp;
}

export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface UserSettings {
  user_id: string;
  default_mode: string;
  default_model: string;
  notification_preferences: NotificationPreferences;
  api_keys: Record<string, unknown>;
  updated_at: Timestamp;
}

export interface NotificationPreferences {
  toast: boolean;
  modal: boolean;
  email: boolean;
}
