import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type {
  WizardState,
  WizardStep,
  ParsedTask,
  AgentConfig,
  PipelineModeType,
  Recommendation,
} from "@/types/wizard";

interface WizardActions {
  setStep: (step: WizardStep) => void;
  setTasks: (tasks: ParsedTask[]) => void;
  setAgents: (agents: AgentConfig[]) => void;
  setMode: (mode: PipelineModeType) => void;
  setRecommendation: (recommendation: Recommendation | null) => void;
  setSubmitting: (isSubmitting: boolean) => void;
  reset: () => void;
}

type WizardStore = WizardState & WizardActions;

const initialState: WizardState = {
  currentStep: 1,
  tasks: [],
  agents: [],
  mode: "review",
  recommendation: null,
  isSubmitting: false,
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

      setRecommendation: (recommendation) => {
        set({ recommendation }, false, "setRecommendation");
      },

      setSubmitting: (isSubmitting) => {
        set({ isSubmitting }, false, "setSubmitting");
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
export const selectRecommendation = (state: WizardStore) => state.recommendation;
export const selectIsSubmitting = (state: WizardStore) => state.isSubmitting;
export const selectHasUnsavedChanges = (state: WizardStore) =>
  state.tasks.length > 0 || state.agents.length > 0;
