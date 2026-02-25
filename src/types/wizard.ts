export type TaskComplexity = "low" | "medium" | "high";

export interface ParsedTask {
  id: string;
  title: string;
  description: string;
  agent_role: "pm" | "engineer" | "reviewer";
  order: number;
  estimated_complexity?: TaskComplexity;
  acceptance_criteria?: string;
}

export interface ParseAnalysis {
  intent: string;
  scope: "small" | "medium" | "large";
  reasoning: string;
}

export interface AgentConfig {
  role: "pm" | "engineer" | "reviewer";
  label: string;
  instruction: string;
  model: "claude-opus-4-6" | "claude-sonnet-4-5-20250514";
  allowedTools: string[];
  chainOrder: number;   // pm=1, engineer=2, reviewer=3
  maxTurns: number;     // default 25
}

export interface Recommendation {
  preset_id: string;
  preset_name: string;
  confidence: number;
  message: string;
}

export type WizardStep = 1 | 2 | 3;

export type PipelineModeType = "auto-edit" | "review" | "plan-only";

export type PipelineCategoryType = "development" | "general";

export interface WizardState {
  currentStep: WizardStep;
  tasks: ParsedTask[];
  agents: AgentConfig[];
  mode: PipelineModeType;
  category: PipelineCategoryType;
  recommendation: Recommendation | null;
  analysis: ParseAnalysis | null;
  isSubmitting: boolean;
  originalQuery: string;
  workingDir: string;
}

export const WIZARD_STEPS = [
  { step: 1 as const, label: "작업 정의", description: "파이프라인 작업을 정의하세요" },
  { step: 2 as const, label: "에이전트 설정", description: "AI 에이전트를 설정하세요" },
  { step: 3 as const, label: "실행 모드", description: "실행 모드를 선택하세요" },
] as const;
