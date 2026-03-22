You are implementing Sprint 5 (final sprint) of the Claude Dev System project.
Project root: `/Users/choeseung-won/personal-project/claudeDevelopmentSystem`

Read CLAUDE.md first for project conventions. Read existing source files before modifying them.

## Sprint 5 Goal
History view + Settings page + Phase 6→0 dashboard loop completion.
This completes the MVP: Phase 0→1→2→3→4→5→6→0 full cycle.

## IMPORTANT: Before starting
```bash
source ~/.nvm/nvm.sh && nvm use 22
npx shadcn@latest add switch slider label pagination table -y
```
Note: next-themes should already be installed. Check first with `npm ls next-themes`.

## Tasks (implement in order)

### BE-5.1: History Query API
Create: `src/app/api/pipelines/history/route.ts`
- GET with query params: status (all|completed|failed|cancelled), search (ilike title), sort (newest|oldest|most_tokens), page (default 1), limit (default 10, max 50)
- Query pipelines WHERE status IN ('completed','failed','cancelled') AND user_id = current user
- Join sessions for token_used, agents for count
- Return: `{ data: { pipelines, total, page, totalPages }, error: null, status: 200 }`

Create: `src/app/api/pipelines/history/[id]/route.ts`
- GET: Pipeline detail with agents, sessions, code_changes joined
- Return full history detail

Create: `src/app/api/pipelines/[id]/rerun/route.ts`
- POST: Copy original pipeline config into new draft pipeline
- Return: `{ data: { pipelineId: newId }, error: null, status: 200 }`

### BE-5.2: User Settings CRUD API
Modify: `src/app/api/settings/route.ts`
- GET: Return user_settings for current user (create default if not exists)
- PATCH body: partial settings object, merge into existing JSONB

Create: `src/app/api/settings/profile/route.ts`
- GET: Return profile (display_name, avatar_url, email from auth)
- PATCH: Update display_name, avatar_url in profiles table

Settings JSONB structure:
```typescript
{
  theme: { colorMode: 'light'|'dark'|'system', accentColor: string },
  tokenPolicy: { defaultBudget: number, warningThresholds: [60,80,90], autoStopOnBudget: boolean },
  notifications: { emailOnComplete: boolean, emailOnError: boolean, browserNotifications: boolean, soundEnabled: boolean }
}
```

### FE-5.1: History List Page
Create: `src/app/(dashboard)/history/page.tsx`

Components:
- Search input (debounce 300ms)
- Status filter dropdown (All/completed/failed/cancelled)
- Sort dropdown (newest/oldest/most_tokens/longest)
- Pipeline history cards:
  - Title + date
  - Status badge + progress bar (100% for completed)
  - Agent count + duration + token usage
  - Click → `/history/[id]`
- Pagination (10 per page)
- Empty state: "아직 완료된 작업이 없습니다"

### FE-5.2: History Detail Page
Create: `src/app/(dashboard)/history/[id]/page.tsx`

Tabs: Agent Activity | Code Changes | Token Usage

Agent Activity tab: Agent cards with tasks completed, tokens used, final status
Code Changes tab: File list with read-only diff links (reuse review components if possible)
Token Usage tab: Simple bar chart using Progress bars (no chart library needed)
  - Per-agent token usage as horizontal bars with labels and numbers

Bottom buttons:
- "다시 실행" → POST /api/pipelines/[id]/rerun → redirect to /pipelines/new?pipeline={newId}
- "대시보드로" → router.push('/dashboard')

### FE-5.3: Settings Page
Create: `src/app/(dashboard)/settings/page.tsx`

5 tabs using shadcn Tabs component:

**1. Profile tab:**
- Display name input
- Email (read-only from auth)
- Save button

**2. Theme tab:**
- Color mode: Radio group (Light / Dark / System) — use next-themes setTheme
- Accent color: Select dropdown
- Live preview on change

**3. Token Policy tab:**
- Default budget: Slider (5000-100000, step 1000)
- Warning thresholds: 3 number inputs (default 60/80/90)
- Auto-stop toggle: Switch

**4. Notifications tab:**
- Email on complete: Switch
- Email on error: Switch
- Browser notifications: Switch
- Sound enabled: Switch

**5. API Key tab:** (for optional Claude API key)
- Masked display (first 10 chars + ****)
- Input field for new key
- Save/Delete buttons with AlertDialog
- Note: "Claude Max 구독 사용 시 API 키가 필요하지 않습니다"

All settings: auto-save on change OR explicit Save button.
Store locally with Zustand persist + sync to Supabase user_settings.

### FE-5.4: Dashboard Return Loop
Modify: `src/app/(dashboard)/dashboard/page.tsx`

Add `RecentHistorySection` component:
- Fetch recent 3 completed/failed pipelines
- Show mini cards with title, status, date
- "전체 보기 →" link to /history
- This completes Phase 6 → Phase 0 loop

## After Implementation
1. Run `npx tsc --noEmit` — fix any type errors
2. Run `npx eslint . --fix` — fix lint issues

## Update CLAUDE.md
Add final learnings. Note that MVP Phase 0→1→2→3→4→5→6→0 cycle is complete.
Mark completion status of each sprint.
