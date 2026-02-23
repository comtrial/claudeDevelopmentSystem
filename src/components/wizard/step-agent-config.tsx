"use client";

import { useCallback, useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useWizardStore } from "@/stores/wizard-store";
import type { AgentConfig } from "@/types/wizard";
import { AgentConfigCard } from "./agent-config-card";

const DEFAULT_AGENTS: AgentConfig[] = [
  {
    role: "pm",
    label: "PM",
    instruction: "",
    model: "claude-sonnet-4-5-20250514",
  },
  {
    role: "engineer",
    label: "Engineer",
    instruction: "",
    model: "claude-sonnet-4-5-20250514",
  },
  {
    role: "reviewer",
    label: "Reviewer",
    instruction: "",
    model: "claude-sonnet-4-5-20250514",
  },
];

export function StepAgentConfig() {
  const agents = useWizardStore((s) => s.agents);
  const setAgents = useWizardStore((s) => s.setAgents);

  // Initialize with defaults if empty
  useEffect(() => {
    if (agents.length === 0) {
      setAgents(DEFAULT_AGENTS);
    }
  }, [agents.length, setAgents]);

  const handleChange = useCallback(
    (index: number, updated: AgentConfig) => {
      const next = agents.map((a, i) => (i === index ? updated : a));
      setAgents(next);
    },
    [agents, setAgents]
  );

  const handleReset = useCallback(() => {
    setAgents(DEFAULT_AGENTS);
  }, [setAgents]);

  const displayAgents = agents.length > 0 ? agents : DEFAULT_AGENTS;

  return (
    <Card>
      <CardHeader>
        <CardTitle>에이전트 설정</CardTitle>
        <CardDescription>
          각 에이전트의 역할과 모델을 설정하세요.
        </CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" onClick={handleReset}>
            <RotateCcw />
            기본값으로 초기화
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          {displayAgents.map((agent, index) => (
            <AgentConfigCard
              key={agent.role}
              config={agent}
              onChange={(updated) => handleChange(index, updated)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
