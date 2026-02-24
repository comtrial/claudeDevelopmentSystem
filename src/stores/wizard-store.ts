import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type {
  WizardState,
  WizardStep,
  ParsedTask,
  ParseAnalysis,
  AgentConfig,
  PipelineModeType,
  PipelineCategoryType,
  Recommendation,
} from "@/types/wizard";

interface WizardActions {
  setStep: (step: WizardStep) => void;
  setTasks: (tasks: ParsedTask[]) => void;
  setAgents: (agents: AgentConfig[]) => void;
  setMode: (mode: PipelineModeType) => void;
  setCategory: (category: PipelineCategoryType) => void;
  setRecommendation: (recommendation: Recommendation | null) => void;
  setAnalysis: (analysis: ParseAnalysis | null) => void;
  setSubmitting: (isSubmitting: boolean) => void;
  setOriginalQuery: (query: string) => void;
  reset: () => void;
}

type WizardStore = WizardState & WizardActions;

const initialState: WizardState = {
  currentStep: 1,
  tasks: [],
  agents: [],
  mode: "review",
  category: "development",
  recommendation: null,
  analysis: null,
  isSubmitting: false,
  originalQuery: "",
};

export const useWizardStore = create<WizardStore>()(
  devtools(
    (set) => ({
      ...initialState,

      setStep: (step) => {
        set({ currentStep: step }, false, "setStep");
      },

      setTasks: (tasks) => {
        set({ tasks }, false, "setTasks");
      },

      setAgents: (agents) => {
        set({ agents }, false, "setAgents");
      },

      setMode: (mode) => {
        set({ mode }, false, "setMode");
      },

      setCategory: (category) => {
        set({ category }, false, "setCategory");
      },

      setRecommendation: (recommendation) => {
        set({ recommendation }, false, "setRecommendation");
      },

      setAnalysis: (analysis) => {
        set({ analysis }, false, "setAnalysis");
      },

      setSubmitting: (isSubmitting) => {
        set({ isSubmitting }, false, "setSubmitting");
      },

      setOriginalQuery: (originalQuery) => {
        set({ originalQuery }, false, "setOriginalQuery");
      },

      reset: () => {
        set(initialState, false, "reset");
      },
    }),
    { name: "wizard-store", enabled: process.env.NODE_ENV === "development" }
  )
);

// Selectors
export const selectCurrentStep = (state: WizardStore) => state.currentStep;
export const selectTasks = (state: WizardStore) => state.tasks;
export const selectAgents = (state: WizardStore) => state.agents;
export const selectMode = (state: WizardStore) => state.mode;
export const selectCategory = (state: WizardStore) => state.category;
export const selectRecommendation = (state: WizardStore) => state.recommendation;
export const selectAnalysis = (state: WizardStore) => state.analysis;
export const selectIsSubmitting = (state: WizardStore) => state.isSubmitting;
export const selectOriginalQuery = (state: WizardStore) => state.originalQuery;
export const selectHasUnsavedChanges = (state: WizardStore) =>
  state.tasks.length > 0 || state.agents.length > 0;
