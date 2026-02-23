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
│   │   ├── pipelines/new/page.tsx       # Wizard
│   │   ├── pipelines/[id]/page.tsx      # Monitoring
│   │   ├── pipelines/[id]/review/page.tsx # Code Review
│   │   ├── history/page.tsx
│   │   ├── history/[id]/page.tsx
│   │   └── settings/page.tsx
│   └── api/
│       ├── pipelines/route.ts           # GET list, POST create
│       ├── pipelines/parse/route.ts     # POST NLP parse
│       ├── pipelines/[id]/route.ts      # GET detail
│       ├── pipelines/[id]/execute/route.ts
│       ├── pipelines/[id]/pause/route.ts
│       ├── pipelines/[id]/resume/route.ts
│       ├── pipelines/[id]/cancel/route.ts
│       ├── pipelines/[id]/logs/route.ts
│       ├── pipelines/[id]/changes/route.ts
│       ├── pipelines/history/route.ts
│       ├── sessions/[id]/route.ts
│       ├── sessions/[id]/tokens/route.ts
│       └── settings/route.ts
├── components/
│   ├── ui/          # shadcn/ui components
│   ├── wizard/      # Sprint 2: Wizard components
│   ├── pipeline/    # Sprint 3: Monitoring components
│   ├── review/      # Sprint 4: Code review components
│   ├── dashboard/   # Dashboard components
│   └── layout/      # Layout components
├── stores/
│   ├── wizard-store.ts
│   ├── pipeline-store.ts
│   └── ui-store.ts
├── lib/
│   ├── supabase/client.ts, server.ts, middleware.ts
│   ├── api/auth.ts, response.ts, errors.ts
│   ├── realtime/use-pipeline-realtime.ts
│   └── pipeline/simulator.ts
└── types/
    ├── wizard.ts
    └── pipeline.ts
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
(Updated automatically during sprint execution)
- Sprint 2 Fix: Replaced Claude API direct call with CLI spawn (child_process.spawn).
  Key pattern: claude -p "prompt" --output-format json --max-turns 1 --model sonnet
- Sprint 3: Supabase Realtime uses `.channel(name).on('postgres_changes', {...}).subscribe()`.
  Cannot filter agent_logs by pipeline_id directly (no join). Use metadata field instead.
- Sprint 3: @tanstack/react-virtual v3 — use `useVirtualizer` hook. React Compiler emits
  "incompatible library" warning (expected, not a build error).
- Sprint 3: ESLint react-hooks/set-state-in-effect — defer setState with setTimeout 0 when
  called inside useEffect body as workaround. Or initialize state to correct value.
- Sprint 3: Supabase Realtime channels must be cleaned up via supabase.removeChannel(ch).
- Sprint 3: Pipeline monitoring page is at pipelines/[id]/page.tsx. The monitor/page.tsx
  stub was left from Sprint 2 WIP.
- Sprint 4: Use `parsePatch` from the `diff` npm package to parse unified diff format into
  hunks. Import: `import { parsePatch } from 'diff'`. Install types: `@types/diff`.
- Sprint 4: Skipped async shiki in favor of regex-based inline tokenization to avoid
  hydration issues and async complexity in client components.
- Sprint 4: `code_change_comments` table may not exist yet — handle with Postgres error
  code `42P01` (undefined_table) and return empty array gracefully.
- Sprint 4: `handleReviewResult` queries latest session by pipeline_id first, since
  code_changes are keyed on session_id (not pipeline_id directly).
- Sprint 4: Review page uses flex-col + flex-1 + overflow-hidden for sticky header/footer
  with scrollable diff area. API routes for changes: nested under pipelines/[id]/changes/.
