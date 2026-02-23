/**
 * Enhanced Agent Simulator (BE-3.4)
 *
 * Simulates realistic multi-agent pipeline execution with:
 * - Configurable speed settings
 * - Role-appropriate Korean log messages
 * - Progressive progress updates
 * - Token consumption simulation
 * - Sample code_changes with unified diffs on completion
 * - Configurable error rate
 */

import { createClient } from "@/lib/supabase/server";

export type SimulatorSpeed = "slow" | "normal" | "fast";

export interface SimulatorOptions {
  speed?: SimulatorSpeed;
  errorRate?: number; // 0-1, probability of random failure
}

const SPEED_INTERVALS: Record<SimulatorSpeed, number> = {
  slow: 3000,
  normal: 1000,
  fast: 300,
};

const TOKENS_PER_LOG = 800;

// Korean log messages per agent role
const ROLE_LOGS: Record<string, { message: string; level: string }[]> = {
  pm: [
    { message: "프로젝트 요구사항 분석을 시작합니다.", level: "info" },
    { message: "기존 코드베이스 아키텍처를 파악하고 있습니다...", level: "info" },
    { message: "태스크 우선순위 및 의존성 그래프를 작성 중입니다.", level: "debug" },
    { message: "Engineer 에이전트에게 구현 태스크를 위임합니다.", level: "info" },
    { message: "전체 작업 계획 수립 완료. 예상 소요 시간: 약 15분", level: "info" },
  ],
  engineer: [
    { message: "할당된 태스크 코드 분석을 시작합니다.", level: "info" },
    { message: "관련 파일 의존성 그래프 분석 완료", level: "debug" },
    { message: "타입 정의 및 인터페이스 설계 중...", level: "info" },
    { message: "핵심 비즈니스 로직 구현 중...", level: "info" },
    { message: "단위 테스트 코드를 작성 중입니다.", level: "info" },
    { message: "ESLint 및 TypeScript 오류 수정 완료", level: "debug" },
    { message: "코드 변경사항 diff 생성 완료", level: "info" },
  ],
  reviewer: [
    { message: "코드 리뷰를 시작합니다.", level: "info" },
    { message: "코딩 컨벤션 및 스타일 가이드 준수 여부 검토 중...", level: "debug" },
    { message: "보안 취약점 (OWASP Top 10) 스캔 완료. 이슈 없음.", level: "info" },
    { message: "성능 영향 분석: 큰 이슈 없음", level: "info" },
    { message: "엣지 케이스 및 에러 핸들링 검토 완료", level: "debug" },
    { message: "코드 리뷰 완료. 최종 승인합니다.", level: "info" },
  ],
  planner: [
    { message: "고수준 아키텍처 설계를 시작합니다.", level: "info" },
    { message: "기술 스택 검토 및 의사결정 진행 중...", level: "info" },
    { message: "마일스톤별 세부 구현 계획 수립 완료", level: "info" },
  ],
  tester: [
    { message: "테스트 시나리오 및 커버리지 분석을 시작합니다.", level: "info" },
    { message: "E2E 테스트 케이스 작성 중...", level: "info" },
    { message: "통합 테스트 실행 중... (3/5 통과)", level: "warn" },
    { message: "모든 테스트 케이스 통과 확인", level: "info" },
  ],
};

const SAMPLE_CODE_CHANGES = [
  {
    file_path: "src/components/pipeline/agent-status-card.tsx",
    change_type: "added" as const,
    diff_content: `@@ -0,0 +1,42 @@
+import React from 'react';
+import { Card, CardContent } from '@/components/ui/card';
+import { Badge } from '@/components/ui/badge';
+import { Progress } from '@/components/ui/progress';
+
+interface AgentStatusCardProps {
+  agent: {
+    id: string;
+    name: string;
+    role: string;
+    status: 'active' | 'idle' | 'completed' | 'error';
+    currentTask: string | null;
+    progress: number;
+  };
+}
+
+export function AgentStatusCard({ agent }: AgentStatusCardProps) {
+  return (
+    <Card className="p-4">
+      <CardContent>
+        <div className="flex items-center justify-between mb-2">
+          <span className="font-medium">{agent.name}</span>
+          <Badge>{agent.status}</Badge>
+        </div>
+        <Progress value={agent.progress} className="h-1.5" />
+      </CardContent>
+    </Card>
+  );
+}`,
    additions: 30,
    deletions: 0,
  },
  {
    file_path: "src/lib/realtime/use-pipeline-realtime.ts",
    change_type: "added" as const,
    diff_content: `@@ -0,0 +1,28 @@
+import { useEffect } from 'react';
+import { createClient } from '@/lib/supabase/client';
+
+export function usePipelineRealtime(pipelineId: string) {
+  useEffect(() => {
+    const supabase = createClient();
+    const channel = supabase.channel(\`pipeline:\${pipelineId}\`)
+      .on('postgres_changes', {
+        event: 'UPDATE',
+        schema: 'public',
+        table: 'pipelines',
+        filter: \`id=eq.\${pipelineId}\`,
+      }, (payload) => {
+        console.log('Pipeline updated:', payload);
+      })
+      .subscribe();
+
+    return () => {
+      supabase.removeChannel(channel);
+    };
+  }, [pipelineId]);
+}`,
    additions: 28,
    deletions: 0,
  },
  {
    file_path: "src/stores/pipeline-store.ts",
    change_type: "modified" as const,
    diff_content: `@@ -1,8 +1,15 @@
 import { create } from 'zustand';
+import { devtools } from 'zustand/middleware';

-interface State { pipelines: any[] }
+interface PipelineState {
+  activePipeline: any | null;
+  agents: any[];
+  logs: any[];
+  connectionStatus: 'connecting' | 'connected' | 'disconnected';
+}

-export const usePipelineStore = create<State>()(() => ({ pipelines: [] }));`,
    additions: 8,
    deletions: 3,
  },
];

interface TaskRow {
  id: string;
  title: string;
  order_index: number;
}

interface AgentRow {
  id: string;
  role: string;
  name: string | null;
}

// Active simulation registry (for stop capability)
const activeSimulations = new Map<string, boolean>();

export function stopSimulation(pipelineId: string): void {
  activeSimulations.set(pipelineId, false);
}

export async function runSimulator(
  pipelineId: string,
  sessionId: string,
  options: SimulatorOptions = {}
): Promise<void> {
  const speed = options.speed ?? "normal";
  const errorRate = options.errorRate ?? 0;
  const interval = SPEED_INTERVALS[speed];

  // Register as active
  activeSimulations.set(pipelineId, true);

  const supabase = await createClient();

  const [{ data: tasks }, { data: agents }] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, order_index")
      .eq("pipeline_id", pipelineId)
      .order("order_index", { ascending: true }),
    supabase
      .from("agents")
      .select("id, role, name")
      .eq("pipeline_id", pipelineId),
  ]);

  if (!tasks || tasks.length === 0 || !agents || agents.length === 0) {
    await completeSession(supabase, pipelineId, sessionId, 0);
    activeSimulations.delete(pipelineId);
    return;
  }

  const agentsByRole = new Map<string, AgentRow>();
  for (const agent of agents as AgentRow[]) {
    agentsByRole.set(agent.role, agent);
  }

  const roleOrder = ["pm", "planner", "engineer", "tester", "reviewer"];
  const activeRoles = roleOrder.filter((r) => agentsByRole.has(r));

  const totalLogs = activeRoles.reduce(
    (sum, role) => sum + (ROLE_LOGS[role]?.length ?? 0),
    0
  );
  const totalSteps = Math.max(totalLogs * (tasks as TaskRow[]).length, 1);
  let currentStep = 0;
  let totalTokens = 0;

  try {
    for (const taskRow of tasks as TaskRow[]) {
      // Check if simulation was stopped
      if (!activeSimulations.get(pipelineId)) {
        await cancelSession(supabase, pipelineId, sessionId, totalTokens);
        return;
      }

      await supabase
        .from("tasks")
        .update({ status: "in_progress" })
        .eq("id", taskRow.id);

      for (const role of activeRoles) {
        const agent = agentsByRole.get(role)!;
        const logs = ROLE_LOGS[role] ?? [];

        // Update agent status to active
        await supabase
          .from("agents")
          .update({ status: "active", current_task: taskRow.title, progress: 0 })
          .eq("id", agent.id);

        for (let i = 0; i < logs.length; i++) {
          if (!activeSimulations.get(pipelineId)) {
            await cancelSession(supabase, pipelineId, sessionId, totalTokens);
            return;
          }

          const log = logs[i];
          currentStep++;
          totalTokens += TOKENS_PER_LOG;
          const progressPct = Math.round((currentStep / totalSteps) * 100);
          const agentProgress = Math.round(((i + 1) / logs.length) * 100);

          // Simulate random error
          if (errorRate > 0 && Math.random() < errorRate) {
            await supabase.from("agent_logs").insert({
              session_id: sessionId,
              agent_id: agent.id,
              agent_role: role,
              level: "error",
              message: `[${taskRow.title}] 예상치 못한 오류가 발생했습니다. 재시도 중...`,
              metadata: { task_id: taskRow.id, step: currentStep },
            });
            await delay(interval);
          }

          await supabase.from("agent_logs").insert({
            session_id: sessionId,
            agent_id: agent.id,
            agent_role: role,
            level: log.level,
            message: `[${taskRow.title}] ${log.message}`,
            metadata: { task_id: taskRow.id, step: currentStep },
          });

          // Update agent progress
          await supabase
            .from("agents")
            .update({ progress: agentProgress })
            .eq("id", agent.id);

          // Update session token usage + overall progress
          await supabase
            .from("sessions")
            .update({
              token_usage: totalTokens,
              metadata: {
                progress_percent: progressPct,
                current_task: taskRow.title,
                current_agent: role,
              },
            })
            .eq("id", sessionId);

          await delay(interval);
        }

        // Mark agent as completed for this round
        await supabase
          .from("agents")
          .update({ status: "idle", progress: 100, current_task: null })
          .eq("id", agent.id);
      }

      await supabase
        .from("tasks")
        .update({ status: "completed" })
        .eq("id", taskRow.id);
    }

    // Insert sample code changes
    for (const diff of SAMPLE_CODE_CHANGES) {
      await supabase.from("code_changes").insert({
        session_id: sessionId,
        file_path: diff.file_path,
        diff_content: diff.diff_content,
        change_type: diff.change_type,
        additions: diff.additions,
        deletions: diff.deletions,
        review_status: "approved",
      });
    }

    await completeSession(supabase, pipelineId, sessionId, totalTokens);
  } catch (err) {
    console.error("[agent-simulator] Error during simulation:", err);
    await failSession(supabase, pipelineId, sessionId, totalTokens);
  } finally {
    activeSimulations.delete(pipelineId);
  }
}

async function completeSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pipelineId: string,
  sessionId: string,
  totalTokens: number
): Promise<void> {
  await supabase
    .from("sessions")
    .update({
      status: "completed",
      token_usage: totalTokens,
      completed_at: new Date().toISOString(),
      metadata: { progress_percent: 100 },
    })
    .eq("id", sessionId);

  await supabase
    .from("pipelines")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", pipelineId);
}

async function failSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pipelineId: string,
  sessionId: string,
  totalTokens: number
): Promise<void> {
  await supabase
    .from("sessions")
    .update({
      status: "failed",
      token_usage: totalTokens,
      completed_at: new Date().toISOString(),
      metadata: { error: "Simulation failed unexpectedly" },
    })
    .eq("id", sessionId);

  await supabase
    .from("pipelines")
    .update({ status: "failed" })
    .eq("id", pipelineId);
}

async function cancelSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pipelineId: string,
  sessionId: string,
  totalTokens: number
): Promise<void> {
  await supabase
    .from("sessions")
    .update({
      status: "cancelled",
      token_usage: totalTokens,
      completed_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  await supabase
    .from("pipelines")
    .update({ status: "cancelled", completed_at: new Date().toISOString() })
    .eq("id", pipelineId);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
