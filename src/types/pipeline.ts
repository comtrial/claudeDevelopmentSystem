import type { Timestamp } from "./api";

export type PipelineStatus =
  | "draft"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export type PipelineMode = "auto_edit" | "review" | "plan_only";

export interface Pipeline {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: PipelineStatus;
  mode: PipelineMode;
  config: Record<string, unknown>;
  preset_template_id: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  started_at: Timestamp | null;
  completed_at: Timestamp | null;
}

export type TaskType = "general" | "code" | "review" | "plan" | "test";

export type TaskStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "skipped";

export interface Task {
  id: string;
  pipeline_id: string;
  title: string;
  description: string | null;
  type: TaskType;
  status: TaskStatus;
  order_index: number;
  input_data: Record<string, unknown>;
  output_data: Record<string, unknown>;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export type ChangeType = "added" | "modified" | "deleted" | "renamed";

export type ReviewStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "changes_requested";

export interface CodeChange {
  id: string;
  session_id: string;
  file_path: string;
  diff_content: string;
  change_type: ChangeType;
  additions: number;
  deletions: number;
  review_status: ReviewStatus;
  reviewer_comments: ReviewerComment[];
  created_at: Timestamp;
}

export interface ReviewerComment {
  agent_role: string;
  comment: string;
  created_at: Timestamp;
}

export interface PipelineHistory {
  id: string;
  pipeline_id: string;
  user_id: string;
  title: string;
  summary: string | null;
  status: string;
  total_tokens: number;
  total_duration_sec: number;
  task_count: number;
  file_changes_count: number;
  config_snapshot: Record<string, unknown>;
  created_at: Timestamp;
}
