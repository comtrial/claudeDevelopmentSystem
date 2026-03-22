You are implementing Sprint 3 of the Claude Dev System project.
Project root: `/Users/choeseung-won/personal-project/claudeDevelopmentSystem`

Read CLAUDE.md first for project conventions. Read existing source files before modifying them.

## Sprint 3 Goal
Pipeline execution monitoring + real-time log streaming.
3-tier monitoring: Glance (agent cards) → Summary (progress) → Detail (logs).

## IMPORTANT: Before starting
Run these commands first:
```bash
source ~/.nvm/nvm.sh && nvm use 22
npm install @tanstack/react-virtual
npx shadcn@latest add scroll-area avatar tooltip toggle -y
```

## Tasks (implement in order)

### BE-3.1: Pipeline Execution API + State Management
Files to create/modify:
- `src/app/api/pipelines/[id]/route.ts` — GET pipeline detail with agents
- `src/app/api/pipelines/[id]/execute/route.ts` — MODIFY existing: add session creation + agent records
- `src/app/api/pipelines/[id]/pause/route.ts` — POST pause
- `src/app/api/pipelines/[id]/resume/route.ts` — POST resume
- `src/app/api/pipelines/[id]/cancel/route.ts` — POST cancel

State transitions:
- draft → running (execute)
- running → paused (pause), completed (all done), failed (error), cancelled (cancel)
- paused → running (resume), cancelled (cancel)
- failed → running (retry via execute)

Each endpoint: authenticate user, verify pipeline ownership, validate state transition, update status.
Return standard API response format (use successResponse/handleError from @/lib/api/response).

### BE-3.2: Agent Log Streaming API
Create: `src/app/api/pipelines/[id]/logs/route.ts`

GET with query params:
- `cursor` (last log id for pagination)
- `limit` (default 50, max 200)
- `agent_id` (filter by agent)
- `level` (filter: info/warn/error/debug/system)

Query agent_logs table with joins to agents(name, role). Order by created_at ASC.
Return `{ data: { logs, nextCursor }, error: null, status: 200 }`.

### BE-3.3: Session Token Management
Create: `src/app/api/sessions/[id]/route.ts` — GET session detail
Create: `src/app/api/sessions/[id]/tokens/route.ts` — PATCH token update

PATCH body: `{ tokensToAdd: number }`
Logic: increment token_used, calculate percentage, if >= 90% set session status to 'warning'.

### BE-3.4: Agent Simulator (Dev Only)
Create: `src/lib/simulator/agent-simulator.ts` — REPLACE existing basic simulator

Enhanced simulator with:
- Configurable speed (slow=3000ms, normal=1000ms, fast=300ms interval)
- Realistic Korean log messages per agent role (PM/Engineer/Reviewer)
- Progressive progress updates (0→100)
- Token consumption simulation
- On completion: insert sample code_changes with valid unified diff
- Error rate parameter (0-1)

Create: `src/app/api/dev/simulate/route.ts` — POST start, DELETE stop
Only active in development (check NODE_ENV).

### FE-3.1: Pipeline Execution Page Layout
Create: `src/app/(dashboard)/pipelines/[id]/page.tsx`

Layout:
- Top: Pipeline title + status Badge + overall Progress bar
- Middle: Agent card grid (3-4 columns responsive)
- Bottom: Action buttons (View Logs, Code Review, Stop/Resume)

Status Badge colors:
```typescript
const statusColorMap = {
  running: 'bg-green-500',
  paused: 'bg-yellow-500',
  completed: 'bg-blue-500',
  failed: 'bg-red-500',
  cancelled: 'bg-gray-500',
}
```

Create: `src/stores/pipeline-store.ts`
```typescript
interface PipelineState {
  activePipeline: any | null
  agents: any[]
  logs: any[]
  connectionStatus: 'connecting' | 'connected' | 'disconnected'
  updatePipelineStatus: (pipeline: any) => void
  updateAgentStatus: (agent: any) => void
  appendLog: (log: any) => void
  setConnectionStatus: (status: string) => void
  setActivePipeline: (pipeline: any) => void
  setAgents: (agents: any[]) => void
  reset: () => void
}
```

### FE-3.2: Agent Status Card
Create: `src/components/pipeline/agent-status-card.tsx`

Props:
```typescript
interface AgentStatusCardProps {
  agent: {
    id: string; name: string;
    role: 'coder' | 'reviewer' | 'planner' | 'tester' | 'pm' | 'engineer';
    status: 'active' | 'idle' | 'completed' | 'error';
    currentTask: string | null;
    progress: number; // 0-100
    tokensUsed: number; tokenBudget: number;
    lastActivity: string;
  }
  onViewLogs: (agentId: string) => void
}
```

Show: name, role icon (lucide-react), status indicator (●green/◐yellow/✓blue/✗red), progress bar, current task (truncate with tooltip), token usage on hover tooltip.

### FE-3.3: Session Lifetime Gauge
Create: `src/components/pipeline/session-lifetime-gauge.tsx`

4-color policy:
- 0-60%: green (no action)
- 60-80%: yellow (inline text warning)
- 80-90%: orange (Toast via sonner)
- 90-100%: red (AlertDialog modal)

Show percentage + token numbers (e.g. "62% — 12,400 / 20,000 tokens").
Import toast from sonner for notifications.

### FE-3.4: WebSocket Realtime Hook
Create: `src/lib/realtime/use-pipeline-realtime.ts`

Custom hook `usePipelineRealtime(pipelineId: string)` that:
1. Subscribes to 3 Supabase Realtime channels:
   - `pipeline:{id}` — pipelines table UPDATE
   - `agents:{id}` — agents table all events
   - `logs:{id}` — agent_logs table INSERT
2. Updates pipeline-store on each event
3. Cleans up channels on unmount
4. Tracks connection status

Use `createClient` from `@/lib/supabase/client`.

### FE-3.5: Real-time Log Viewer
Create: `src/components/pipeline/log-viewer.tsx`

Features:
- Virtual scroll with @tanstack/react-virtual (handle 10,000+ logs)
- Auto-scroll toggle (ON by default, pause on manual scroll)
- Filter: agent dropdown, level dropdown, keyword search (debounce 300ms)
- Level colors: info=blue, warn=yellow, error=red, debug=gray, system=purple
- Each line: timestamp (HH:mm:ss) + agent badge + level + message

### FE-3.6: Pipeline Controls
Create: `src/components/pipeline/pipeline-controls.tsx`

Buttons: Pause, Resume, Cancel (with AlertDialog confirmation)
Enable/disable based on pipeline status:
- running: pause ✅, cancel ✅
- paused: resume ✅, cancel ✅
- completed/failed/cancelled: all disabled (except code review link)

Show loading state during API calls, Toast on error.

## After Implementation
1. Run `npx tsc --noEmit` — fix any type errors
2. Run `npx eslint . --fix` — fix lint issues
3. Verify all new files exist with correct exports

## Update CLAUDE.md
Add learnings about Supabase Realtime patterns, virtual scrolling, or any issues encountered.
