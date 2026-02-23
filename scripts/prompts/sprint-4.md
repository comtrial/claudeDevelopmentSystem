You are implementing Sprint 4 of the Claude Dev System project.
Project root: `/Users/choeseung-won/personal-project/claudeDevelopmentSystem`

Read CLAUDE.md first for project conventions. Read existing source files before modifying them.

## Sprint 4 Goal
Code review with Git Diff visualization. Users can review agent-generated code changes with unified/split diff view, line comments, and approve/reject actions.

## IMPORTANT: Before starting
```bash
source ~/.nvm/nvm.sh && nvm use 22
npm install diff shiki
npx shadcn@latest add popover textarea radio-group accordion -y
```

## Tasks (implement in order)

### BE-4.1: Code Changes CRUD API
Create: `src/app/api/pipelines/[id]/changes/route.ts`
- GET: List code changes for pipeline (file_path, change_type, additions, deletions, review_status)
- Response: `{ data: changes[], error: null, status: 200 }`

Create: `src/app/api/pipelines/[id]/changes/[changeId]/route.ts`
- GET: Single change detail with diff_content, old_content, new_content

Create: `src/app/api/pipelines/[id]/changes/[changeId]/review/route.ts`
- PATCH body: `{ action: 'approve' | 'request_changes' | 'reject', comment?: string }`
- Maps action to review_status: approve→'approved', request_changes→'changes_requested', reject→'rejected'
- After update: check if ALL changes are approved → pipeline status → 'completed'
- If any rejected → pipeline status → 'failed'

Create: `src/app/api/pipelines/[id]/changes/[changeId]/comments/route.ts`
- GET: List comments for a change (join with line_number)
- POST body: `{ line_number: number, content: string }`
- author_type: 'user', author_id: current user id

Create: `src/app/api/pipelines/[id]/review/approve-all/route.ts`
- POST: Bulk approve all pending changes

### BE-4.2: Line Comment Table + Realtime
If table `code_change_comments` doesn't exist in Supabase, the API should handle gracefully.
Columns expected: id, change_id, line_number, content, author_type('user'|'agent'), author_id, agent_id, created_at

### BE-4.3: Review Result → Monitoring Integration
Create utility: `src/lib/review/handle-review-result.ts`
```typescript
export async function handleReviewResult(supabase: any, pipelineId: string) {
  const { data: changes } = await supabase
    .from('code_changes')
    .select('review_status')
    .eq('pipeline_id', pipelineId)

  const statuses = changes?.map((c: any) => c.review_status) ?? []

  if (statuses.length > 0 && statuses.every((s: string) => s === 'approved')) {
    await supabase.from('pipelines').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', pipelineId)
  } else if (statuses.some((s: string) => s === 'rejected')) {
    await supabase.from('pipelines').update({ status: 'failed' }).eq('id', pipelineId)
  }
}
```

### FE-4.1: Code Review Page Layout
Create: `src/app/(dashboard)/pipelines/[id]/review/page.tsx`

Layout:
- Top: Review title + file count summary + status summary
- Left sidebar: Changed file list (accordion style)
- Main: Diff viewer with Unified/Split tabs
- Bottom: Bulk action buttons (Approve All, Request Changes, Reject)

URL: `/pipelines/[id]/review`

### FE-4.2: Git Diff Viewer
Create: `src/components/review/diff-viewer.tsx`

Props:
```typescript
interface DiffViewerProps {
  change: {
    id: string; file_path: string;
    change_type: 'added' | 'modified' | 'deleted';
    diff_content: string;
    old_content: string | null;
    new_content: string;
    review_status: string;
  }
  mode: 'unified' | 'split'
  onLineComment: (lineNumber: number) => void
}
```

Use `diff` npm package to parse unified diff format.
Use `shiki` for syntax highlighting (languages: typescript, javascript, sql, json, css).

Unified mode: single column, green bg for additions (+), red bg for removals (-).
Split mode: 2 columns grid, old content left, new content right.

Line numbers on each side. Comment button (💬) on hover per line.

### FE-4.3: Line Comments + Review Actions
Create: `src/components/review/line-comment.tsx`
- Popover on line hover click → Textarea + Submit button
- Show existing comment thread (user vs agent distinction)

Create: `src/components/review/review-actions.tsx`
- 3 actions: Approve (green), Request Changes (yellow), Reject (red)
- Request Changes requires comment input
- Reject shows AlertDialog confirmation
- Each action calls PATCH API

### FE-4.4: File Tree + Review Summary
Create: `src/components/review/file-tree.tsx`
- File list: change type icon + filename + +/- count + review status badge
- Active file highlight
- Click to scroll to that file's diff

Create: `src/components/review/review-summary.tsx`
- Total files, approved count, pending count, rejected count
- Total additions/deletions
- Progress bar (approved / total)

## After Implementation
1. Run `npx tsc --noEmit` — fix any type errors
2. Run `npx eslint . --fix` — fix lint issues

## Update CLAUDE.md
Add learnings about diff parsing, shiki integration, or any issues encountered.
