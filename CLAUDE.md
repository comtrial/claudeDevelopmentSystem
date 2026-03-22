# Claude Dev System — Project Instructions

## Overview
AI 에이전트 스웜 개발 시스템의 웹 대시보드. localhost:3000에서 실행되는 로컬 도구.

## Tech Stack
- **Framework**: Next.js 16.1.6 (App Router, TypeScript strict, Turbopack)
- **UI**: shadcn/ui (Default style, Neutral), Tailwind CSS v4, Framer Motion
- **State**: Zustand (with devtools)
- **Backend**: Supabase (PostgreSQL 17, Realtime, RLS, SSR)
- **Auth**: Supabase Auth (@supabase/ssr)
- **Testing**: Playwright (e2e/ directory)
- **Node.js**: v22 (use `source ~/.nvm/nvm.sh && nvm use 22` before any node command)

## Critical Principles
1. **로컬 실행 원칙**: `localhost:3000` — Vercel 서버리스 아님
2. **Claude CLI spawn**: `child_process.spawn("claude", [...])` 사용 — `api.anthropic.com` 직접 호출 금지
3. **API 비용 $0**: Claude Max 구독 활용, CLI가 로컬 인증 사용
4. **하이브리드 저장**: 실행 중 로컬 MD/JSON + 완료 후 Supabase

## File Structure
```
src/
├── app/
│   ├── (auth)/login/page.tsx, signup/page.tsx
│   ├── (dashboard)/
│   │   ├── dashboard/page.tsx
│   │   ├── pipelines/page.tsx           # Pipeline list
│   │   ├── pipelines/new/page.tsx       # Wizard
│   │   ├── pipelines/[id]/page.tsx      # Monitoring
│   │   ├── pipelines/[id]/monitor/      # Monitor sub-route
│   │   ├── pipelines/[id]/review/       # Code Review
│   │   ├── history/page.tsx
│   │   ├── history/[id]/page.tsx
│   │   └── settings/page.tsx
│   └── api/
│       ├── pipelines/route.ts           # GET list, POST create
│       ├── pipelines/parse/route.ts     # POST NLP parse
│       ├── pipelines/clone/route.ts     # POST clone pipeline
│       ├── pipelines/history/route.ts   # GET completed pipelines
│       ├── pipelines/[id]/route.ts      # GET detail
│       ├── pipelines/[id]/execute/route.ts
│       ├── pipelines/[id]/pause/route.ts
│       ├── pipelines/[id]/resume/route.ts
│       ├── pipelines/[id]/cancel/route.ts
│       ├── pipelines/[id]/logs/route.ts
│       ├── pipelines/[id]/changes/route.ts
│       ├── pipelines/[id]/rerun/route.ts
│       ├── pipelines/[id]/review/approve-all/
│       ├── pipelines/[id]/sessions/route.ts
│       ├── history/[id]/route.ts
│       ├── sessions/[id]/route.ts
│       ├── settings/route.ts
│       └── templates/route.ts
├── components/
│   ├── ui/          # shadcn/ui components
│   ├── auth/        # Auth components
│   ├── wizard/      # Sprint 2: Wizard components
│   ├── pipeline/    # Sprint 3: Monitoring components
│   ├── review/      # Sprint 4: Code review components
│   ├── dashboard/   # Dashboard components
│   ├── layout/      # Layout components
│   └── providers/   # Context providers
├── stores/
│   ├── auth-store.ts
│   ├── wizard-store.ts
│   ├── pipeline-store.ts
│   └── ui-store.ts
├── lib/
│   ├── supabase/client.ts, server.ts, middleware.ts
│   ├── api/auth.ts, response.ts, errors.ts
│   ├── realtime/use-pipeline-realtime.ts
│   ├── pipeline/simulator.ts, sample-data.ts
│   ├── review/handle-review-result.ts
│   ├── simulator/agent-simulator.ts
│   └── websocket/
└── types/
    ├── wizard.ts, pipeline.ts, agent.ts
    ├── session.ts, api.ts, template.ts
    ├── pipeline-summary.ts
    └── websocket.ts
```

## API Response Format
All API responses follow this standard format:
```typescript
// Success
{ data: T, error: null, status: number }

// Error
{ data: null, error: { message: string, code: string }, status: number }
```

Use `successResponse()` and `handleError()` from `@/lib/api/response`.

## Design Tokens (CSS Variables)
```css
/* Status colors */
--healthy, --warning, --danger, --critical, --idle, --running

/* Agent colors */
--agent-pm (purple), --agent-engineer (blue), --agent-reviewer (green)
```

## Supabase Tables
`profiles`, `pipelines`, `tasks`, `agents`, `sessions`, `agent_logs`,
`code_changes`, `code_change_comments`, `preset_templates`, `user_settings`

## Key Conventions
- Korean comments for UI-facing strings
- English for code comments
- All API routes use `getAuthenticatedUser()` from `@/lib/api/auth`
- Supabase RLS on all tables (user_id based)
- shadcn/ui components in `src/components/ui/`
- Use `cn()` from `@/lib/utils` for className merging

## Learnings

### Sprint 2 Fix
- Replaced Claude API direct call (`api.anthropic.com`) with CLI spawn (`child_process.spawn`).
- Key CLI pattern: `claude -p "prompt" --output-format json --max-turns 1 --model sonnet`
- No API key needed — CLI uses local Claude Max authentication.

### Sprint 3 (Monitoring + Realtime)
- Supabase Realtime: Subscribe to 3 channels (pipeline/agents/logs) with cleanup on unmount.
- `@tanstack/react-virtual` useVirtualizer triggers React Compiler warning — safe to ignore.
- Session gauge 4-color policy: use refs to prevent duplicate toast/modal firing.
- Pipeline store log buffer capped at 2000 entries to prevent memory leaks.

### Sprint 4 (Code Review Diff)
- `diff` npm package `parsePatch()` for unified diff parsing.
- Syntax highlighting: regex-based tokenizer (lightweight) instead of full shiki for MVP.
- Line comment UX: Popover on hover button click, not inline expansion.
- Review state machine: pending → approved/changes_requested/rejected.

### Sprint 5 (History + Settings)
- History pagination: offset-based (page/limit) for list, cursor-based for logs.
- Settings: Zustand persist for local + Supabase sync for cross-device.
- Dashboard return loop: Phase 6→0 via "대시보드로" button + recent history section.
- MVP full cycle: Phase 0→1→2→3→4→5→6→0 complete.

### Input Validation for Claude CLI
- Claude CLI NLP parse requires **minimum input length** (10 chars) — trivial inputs like "hi" cause JSON parse failures and 422 errors.
- Always validate both frontend (button disable + hint message) and backend (400 error) to prevent meaningless CLI invocations.
- Pattern: frontend UX guard first, backend safety net second.

### Code Quality Patterns
- All API routes MUST use `getAuthenticatedUser()` from `@/lib/api/auth` (not `createClient()` directly).
- All responses MUST use `successResponse()` / `handleError()` from `@/lib/api/response`.
- Avoid bare `as` type assertions — use validation or type guards.
- Remove debug `console.log` before committing.
- Prefix unused variables with `_` to satisfy ESLint.

### Architecture Principles (CRITICAL)
- **Never** call `api.anthropic.com` — always use `child_process.spawn("claude", [...])`.
- localhost:3000 execution only — not Vercel serverless.
- Claude Max subscription = $0 API cost.
- Hybrid storage: local MD/JSON (running) + Supabase (completed).

### Follow-Up Query Feature
- Sessions support chain structure via `parent_session_id` + `session_number` fields.
- Execute route accepts `follow_up_prompt` in body for follow-up sessions from completed/failed pipelines.
- Max 10 sessions per pipeline enforced in execute route.
- Follow-up context injection: previous session's logs (last 20 info/warn/error) + code changes passed to `buildTaskPrompt()`.
- LogViewer supports `sessionId` prop for session-specific log filtering; clears logs on session switch.
- SessionSelector: Tabs for ≤3 sessions, Select dropdown for 4+.

### Agent Chain Architecture v3
- **Chain model**: PM → Engineer → Reviewer sequential chain (not task-per-agent isolation)
- **Mode filtering**: `plan_only` → PM only, `review` → Engineer+Reviewer, `auto_edit` → all 3
- **System/User prompt separation**: Role identity + permanent rules → `--append-system-prompt`, methodology + tasks → `-p`
- **XML structured prompts**: `<instructions>`, `<tasks>`, `<artifact>`, `<context>` tags for clear section separation
- **CLAUDE.md auto-injection**: `readFileSync` loads CLAUDE.md into system prompt (max 8K chars)
- **Methodology prompts**: PM has Step 0 (Project Discovery) + scope guard + self-check; Engineer has tool use strategy + dry run + incremental; Reviewer has mandatory file reading + line citations + priority order
- **Negative examples**: Each role has "Common Mistakes to AVOID" section
- **Feedback loop**: Reviewer CHANGES_REQUESTED → Engineer rework → Reviewer re-verify (max 2 cycles)
- **Structured verdict**: Reviewer outputs ```` ```verdict {"approved": bool, ...} ``` ```` for reliable parsing with JSON→text fallback
- **Validation pipeline**: TypeCheck (`tsc --noEmit`) → Build (`npm run build`) → Lint (`eslint`) before Reviewer phase
- **Artifact budget**: 60K chars per agent (head 70% + tail 30%), 200K save to DB config JSONB
- **Allowed tools**: Added `Glob` and `Grep` to default tools list
- Config fields: `chainOrder` (agent execution order), `maxTurns` (per-agent turn limit) stored in agents.config JSONB
