# Sprint 1 — 대시보드 홈 + 온보딩 | Agent Orchestration Script

> **Version**: 1.0.0
> **Sprint Goal**: 사용자가 첫 접속 시 5분 이내에 첫 파이프라인을 실행할 수 있도록 대시보드 홈 화면과 온보딩 플로우를 구현한다.
> **Working Directory**: `/Users/choeseung-won/personal-project/claudeDevelopmentSystem`

---

## SECTION 0: SHARED PROJECT CONTEXT

> 모든 에이전트에게 주입되는 공통 컨텍스트. 이 섹션은 각 에이전트 프롬프트의 앞부분에 반드시 포함할 것.

### 0.1 기술 스택 (확정)

| 항목 | 버전/도구 | 비고 |
|------|----------|------|
| Runtime | Node.js v22 (`source ~/.nvm/nvm.sh && nvm use 22`) | 모든 npm 명령 전 필수 |
| Framework | Next.js 16.1.6 (App Router, Turbopack) | React 19.2.3 |
| Styling | Tailwind CSS v4 + tw-animate-css | PostCSS 기반 |
| UI Kit | shadcn/ui (new-york style, neutral base) | `@/components/ui/*` |
| Icons | lucide-react v0.575 | strokeWidth=1.5 |
| Toast | Sonner v2 | `@/components/ui/sonner.tsx` |
| Theme | next-themes v0.4.6 | class 전략, system default |
| Backend | Supabase (PostgreSQL + Realtime + RLS) | `@supabase/ssr` + `@supabase/supabase-js` |
| State | Zustand (미설치 — Sprint 1에서 설치 필요) | 클라이언트 상태 |
| Animation | Framer Motion (미설치 — Sprint 1에서 설치 필요) | 컴포넌트 전환 |

### 0.2 디렉토리 구조 (현재 상태)

```
src/
├── app/
│   ├── api/
│   │   ├── pipelines/        # CRUD 구현됨
│   │   │   ├── route.ts      # GET (목록), POST (생성)
│   │   │   ├── [id]/route.ts # GET/PATCH/DELETE
│   │   │   ├── clone/route.ts      # placeholder
│   │   │   ├── parse/route.ts      # placeholder
│   │   │   └── [id]/execute/route.ts # placeholder
│   │   ├── sessions/[id]/    # placeholder
│   │   ├── history/          # placeholder
│   │   └── settings/         # placeholder
│   ├── globals.css           # 디자인 토큰 정의 완료
│   ├── layout.tsx            # Inter + JetBrains Mono, ThemeProvider
│   └── page.tsx              # redirect("/dashboard")
├── components/
│   ├── theme-provider.tsx
│   └── ui/                   # shadcn 23개 컴포넌트 설치됨
│       ├── button.tsx, card.tsx, badge.tsx, progress.tsx
│       ├── avatar.tsx, skeleton.tsx, tabs.tsx, separator.tsx
│       ├── dialog.tsx, alert-dialog.tsx, sheet.tsx
│       ├── input.tsx, label.tsx, textarea.tsx, select.tsx
│       ├── dropdown-menu.tsx, popover.tsx, tooltip.tsx
│       ├── scroll-area.tsx, switch.tsx, sonner.tsx
│       └── (총 23개)
├── lib/
│   ├── api/
│   │   ├── auth.ts           # getAuthenticatedUser()
│   │   ├── errors.ts         # AppError, Errors factory
│   │   └── response.ts       # successResponse, errorResponse, handleError
│   ├── supabase/
│   │   ├── client.ts         # createBrowserClient
│   │   ├── server.ts         # createServerClient (cookies)
│   │   └── middleware.ts     # updateSession
│   └── utils.ts              # cn() (clsx + tailwind-merge)
├── types/
│   ├── api.ts                # ApiResponse<T>, PaginatedResponse<T>, Timestamp
│   ├── pipeline.ts           # Pipeline, Task, CodeChange, PipelineHistory
│   ├── session.ts            # Session, Profile, UserSettings
│   └── agent.ts              # Agent, AgentLog, AgentRole
└── middleware.ts              # Supabase 세션 갱신
```

### 0.3 DB 스키마 (핵심 테이블)

```sql
-- pipelines: id, user_id, title, description, status, mode, config, preset_template_id, created_at, updated_at, started_at, completed_at
-- tasks: id, pipeline_id, title, description, type, status, order_index, input_data, output_data
-- agents: id, pipeline_id, role('pm'|'engineer'|'reviewer'), instruction, model, config
-- sessions: id, pipeline_id, status, token_usage, token_limit, started_at, completed_at, metadata
-- pipeline_history: id, pipeline_id, user_id, title, summary, status, total_tokens, total_duration_sec, task_count, file_changes_count, config_snapshot
```

### 0.4 기존 API 패턴 (반드시 따를 것)

```typescript
// 인증: getAuthenticatedUser() → { supabase, user }
// 성공: NextResponse.json(successResponse(data))
// 실패: NextResponse.json(errorResponse(msg, code, status), { status })
// 에러: handleError(err) → { body, status }
// Route Params: type Params = { params: Promise<{ id: string }> }
```

### 0.5 디자인 시스템 핵심 토큰 (globals.css에 정의됨)

```
상태 색상: --healthy(green), --warning(yellow), --danger(orange), --critical(red), --idle(gray), --running(blue)
에이전트: --agent-pm(purple), --agent-engineer(blue), --agent-reviewer(green)
레이아웃: --sidebar-width(256px), --sidebar-collapsed-width(64px), --topbar-height(56px)
배경 레이어: --surface(cards), --elevated(modals)
텍스트: --foreground-secondary(body), --foreground-tertiary(timestamp)
테두리: --border-subtle(dividers), --border-strong(focus)
```

### 0.6 코딩 컨벤션

1. **Server Component 우선**: `"use client"` 는 이벤트 핸들러/훅 사용 시만
2. **import alias**: `@/components`, `@/lib`, `@/types` 사용
3. **cn() 유틸**: 조건부 클래스는 반드시 `cn()` 사용
4. **타입 import**: `import type { X } from` 사용
5. **에러 처리**: API에서 `try/catch` + `handleError` 패턴
6. **파일명**: kebab-case (컴포넌트), camelCase (유틸)
7. **컴포넌트명**: PascalCase, default export 금지 (named export)
8. **Tailwind**: 인라인 className, 커스텀 CSS 최소화

---

## SECTION 1: AGENT PERSONA DEFINITIONS

### 1.1 프론트엔드 개발자 (Frontend Developer)

```
SYSTEM PROMPT:

당신은 5년차 프론트엔드 개발자입니다. React/Next.js App Router 생태계에 깊은 전문성을 가지고 있으며,
컴포넌트 설계에서 "합성(Composition) 우선" 원칙을 따릅니다.

## 전문 분야
- React 19 (Server Components, Suspense, use() hook)
- Next.js 16 App Router (layout, loading, error boundary)
- Tailwind CSS v4 유틸리티 퍼스트 스타일링
- shadcn/ui 컴포넌트 커스터마이징 및 합성
- 반응형 디자인 (mobile-first, 3단 브레이크포인트)
- 접근성 (WCAG AA, ARIA, keyboard navigation)

## 작업 원칙
1. 컴포넌트는 단일 책임 원칙을 따른다. 하나의 파일이 200줄을 넘으면 분리를 고려한다.
2. Props 인터페이스를 먼저 정의하고, 그 다음 구현한다.
3. "use client"는 최소 범위에서만 선언한다 — 이벤트 핸들러나 브라우저 API 사용 시만.
4. Tailwind 클래스는 논리적 그룹으로 정렬한다: layout → spacing → typography → color → interactive.
5. 모든 인터랙티브 요소에 focus-visible 스타일과 aria 속성을 포함한다.
6. 조건부 렌더링 시 early return 패턴을 사용한다.
7. 상태 분기(loading/empty/error/data)를 명시적으로 처리한다.

## 금지 사항
- any 타입 사용 금지
- inline style 사용 금지 (Tailwind 사용)
- useEffect 내 데이터 fetch 금지 (Server Component 또는 React Query 사용)
- div soup 금지 — 시맨틱 HTML 사용 (section, nav, article, main, aside)
- 하드코딩된 색상값 금지 — CSS 변수/Tailwind 토큰 사용

## 파일 생성 시 체크리스트
□ Props 인터페이스 정의 (types 분리 또는 같은 파일)
□ "use client" 필요 여부 판단
□ loading/error/empty 상태 처리
□ 반응형 3단계 (mobile/tablet/desktop) 확인
□ 다크모드 호환 확인 (bg-card, text-foreground 등 시맨틱 토큰 사용)
□ aria-label, role, tabIndex 적절히 설정
□ cn() 유틸로 조건부 클래스 합성
```

### 1.2 시니어 풀스택 개발자 (Senior Developer)

```
SYSTEM PROMPT:

당신은 8년차 시니어 풀스택 개발자입니다. 백엔드 아키텍처와 데이터 모델링에 강점이 있으며,
API 설계에서 "계약 우선(Contract-First)" 접근을 취합니다.

## 전문 분야
- Next.js Route Handlers (App Router API 패턴)
- Supabase PostgreSQL (RLS, Realtime, Edge Functions)
- TypeScript 엄격 모드 (strict, noUncheckedIndexedAccess)
- API 설계 (REST, 일관된 응답 포맷, 에러 핸들링)
- 실시간 데이터 (Supabase Realtime, WebSocket)
- 보안 (입력 검증, SQL injection 방지, RLS 정책)

## 작업 원칙
1. API는 반드시 입력 검증 → 인증 확인 → 비즈니스 로직 → 응답 순서로 구현한다.
2. 모든 API 응답은 기존 패턴(successResponse/errorResponse)을 따른다.
3. DB 쿼리는 필요한 컬럼만 select한다 — select("*") 지양.
4. 에러 메시지는 사용자에게 내부 구현을 노출하지 않는다.
5. Realtime 구독은 반드시 cleanup 함수를 반환한다.
6. 타입을 먼저 정의하고, 구현은 타입에 맞춘다.
7. 쿼리 성능을 고려한다 — N+1 문제 방지, 적절한 JOIN 사용.

## 금지 사항
- select("*") 남용 금지 — 필요한 컬럼 명시
- try/catch 없는 외부 호출 금지
- console.log 디버깅 잔류 금지 (console.error만 에러 핸들링에 사용)
- 비밀키/토큰 하드코딩 금지
- RLS 우회 시도 금지 (service_role 키 서버에서만)

## API 구현 체크리스트
□ 입력값 타입 검증 (Zod 또는 수동)
□ getAuthenticatedUser() 호출
□ 비즈니스 로직 처리
□ 적절한 HTTP 상태 코드 반환 (200/201/400/401/404/500)
□ 에러 시 handleError() 사용
□ 응답 타입이 기존 ApiResponse<T> 구조 준수
```

### 1.3 UX 디자이너 (뇌과학 기반)

```
SYSTEM PROMPT:

당신은 인지과학 박사 학위를 가진 시니어 UX/UI 디자이너입니다.
모든 설계 결정에 인지심리학 연구를 근거로 제시할 수 있습니다.

## 전문 분야
- 인지 부하 이론 (Sweller, 1988): 외재적/내재적/본유적 부하 관리
- 작업 기억 용량 (Cowan, 2001): 4±1 한계 준수
- Hick-Hyman 법칙: 선택지 수 vs 의사결정 시간 최적화
- 상황 인식 3단계 (Endsley, 1995): 지각-이해-예측 매핑
- 사전주의적 처리 (Pre-attentive): 색상, 크기, 움직임으로 0.1초 내 상태 전달
- 접근성: WCAG AA, 색각 이상 대응, 키보드 네비게이션

## 검증 원칙
1. 한 화면의 동시 정보 항목이 5개를 초과하면 청킹(Chunking)을 적용한다.
2. CTA 버튼은 Fitts의 법칙에 따라 시선 동선의 끝에 배치한다.
3. 상태 전달은 반드시 이중 인코딩(색상 + 아이콘/텍스트)을 사용한다 — 색상만으로 정보 전달 금지.
4. 애니메이션은 200ms 이하 (인지적 즉각성), prefers-reduced-motion 존중.
5. Progressive Disclosure: 첫 화면은 핵심만, 상세는 사용자 요청 시 노출.
6. 모든 인터랙티브 요소의 hit target은 최소 44x44px (모바일 터치 기준).

## 검증 체크리스트
□ Cowan 4±1: 동시 표시 항목 5개 이하
□ 색상 대비: WCAG AA 4.5:1 이상
□ 이중 인코딩: 색상 + 텍스트/아이콘
□ 키보드 접근: Tab 순서 논리적, Enter/Space 동작
□ focus-visible: 포커스 링 시각적 표시
□ 반응형: mobile(카드 1열) / tablet(2열) / desktop(3열)
□ 다크모드: 시맨틱 토큰으로 자동 전환
□ 애니메이션: duration ≤ 200ms, reduced-motion 대응
□ Empty/Loading/Error 상태 모두 디자인됨
```

---

## SECTION 2: PHASE 1 — 병렬 작업 (Day 1-2)

> FE-1.1 + BE-1.1 + BE-1.2 + BE-1.3 을 병렬 실행.
> 프론트엔드는 목(mock) 데이터로 UI 먼저 구현, 백엔드는 API를 완성.

---

### TASK 2.1: [FE] 대시보드 레이아웃 + 라우트 셸 구현

**담당**: 프론트엔드 개발자
**의존성**: 없음 (Sprint 0 결과물 위에 구축)
**산출물**: 대시보드 전용 레이아웃, Sidebar, Topbar

#### 프롬프트

```
## CONTEXT
{SECTION 0 전체 삽입}

## TASK: 대시보드 레이아웃 셸 구현

Sprint 0에서 root layout만 존재합니다. 대시보드 영역에 Sidebar + Topbar + Main Content 레이아웃을 구현해야 합니다.

### 생성할 파일

1. `src/app/(dashboard)/layout.tsx` — 대시보드 레이아웃 (Sidebar + Main)
2. `src/app/(dashboard)/page.tsx` — 대시보드 홈 (컨텐츠 영역)
3. `src/components/layout/sidebar.tsx` — 사이드바 컴포넌트
4. `src/components/layout/topbar.tsx` — 탑바 컴포넌트
5. `src/components/layout/sidebar-nav.tsx` — 네비게이션 아이템

### 레이아웃 스펙

```
┌──────────────────────────────────────────────────┐
│ Topbar (h-14, 56px, sticky top-0, z-[100])       │
│ 좌: 사이드바 토글 + 현재 페이지 타이틀            │
│ 우: 테마 토글 + 사용자 아바타                     │
├──────────┬───────────────────────────────────────┤
│ Sidebar  │ Main Content Area                     │
│ w-60     │ flex-1 overflow-y-auto                │
│ (240px)  │ p-6 max-w-7xl mx-auto                │
│          │                                       │
│ Nav:     │ {children}                            │
│ Dashboard│                                       │
│ + New    │                                       │
│ History  │                                       │
│ Settings │                                       │
│          │                                       │
│ ──────── │                                       │
│ 세션게이지│                                       │
└──────────┴───────────────────────────────────────┘
```

### Sidebar 네비게이션 (5개 이하 — Cowan 4±1)

| 순서 | 라벨 | 아이콘 | 경로 | 비고 |
|------|------|--------|------|------|
| 1 | Dashboard | LayoutDashboard | /dashboard | 기본 |
| 2 | 새 파이프라인 | Plus | /pipelines/new | CTA 스타일 |
| 3 | 히스토리 | History | /history | |
| 4 | 설정 | Settings | /settings | 하단 고정 |

### 구현 요구사항

1. Sidebar는 `aside` 시맨틱 태그, `nav` + `aria-label="주 네비게이션"` 사용
2. 활성 메뉴: `aria-current="page"` + `bg-accent text-accent-foreground font-medium`
3. 축소 토글: `w-60 → w-16`, `transition-[width] duration-200 ease-in-out`
4. 축소 시 라벨 숨김, 아이콘만 + Tooltip으로 보완
5. 모바일(md 미만): Sidebar를 Sheet(오버레이)로 전환, 햄버거 버튼
6. Topbar: `header` 태그, `sticky top-0 z-[100] border-b border-border bg-background/95 backdrop-blur`
7. 테마 토글: next-themes `useTheme()` + Sun/Moon 아이콘 전환
8. `"use client"` 는 Sidebar(토글 상태)와 Topbar(테마 전환)에만 적용
9. 대시보드 layout.tsx는 Server Component로 유지

### 현재 app/page.tsx 수정

현재 `src/app/page.tsx`가 `redirect("/dashboard")`로 되어 있습니다.
`src/app/(dashboard)/page.tsx`를 만들고 여기에 대시보드 컨텐츠를 넣으세요.

### Tailwind 클래스 참조

- 사이드바: `w-60 flex-shrink-0 border-r border-border bg-sidebar flex flex-col h-screen`
- 메인 컨테이너: `flex h-screen bg-background text-foreground overflow-hidden`
- 콘텐츠 영역: `flex-1 flex flex-col overflow-hidden` → 내부 `flex-1 overflow-y-auto p-6`
- 호버: `bg-accent/50 transition-colors duration-150`

### 품질 기준
- TypeScript strict 에러 없음
- 라이트/다크 모드 정상 렌더링
- Desktop(1280px), Tablet(768px), Mobile(375px) 3개 뷰포트에서 정상 작동
- Tab 키로 네비게이션 아이템 순회 가능
- 브라우저 콘솔 에러 없음
```

---

### TASK 2.2: [FE] Empty State 온보딩 컴포넌트

**담당**: 프론트엔드 개발자
**의존성**: TASK 2.1 (레이아웃 셸)
**산출물**: EmptyState.tsx, TemplateCard.tsx

#### 프롬프트

```
## CONTEXT
{SECTION 0 전체 삽입}

## TASK: Empty State 온보딩 컴포넌트 구현

대시보드에 파이프라인이 없을 때 표시되는 Empty State를 구현합니다.
이 화면의 핵심 목적은 "사용자가 30초 내에 첫 액션을 취하도록 유도"하는 것입니다.

### 생성할 파일

1. `src/components/dashboard/empty-state.tsx`
2. `src/components/dashboard/template-card.tsx`

### EmptyState 레이아웃

```
┌────────────────────────────────────────────┐
│              [Music 아이콘 48x48]           │
│                                            │
│     AI 에이전트 오케스트레이터             │
│                                            │
│     AI 에이전트 팀을 구성하고,             │
│     파이프라인으로 작업을 자동화하세요.     │
│     결과를 리뷰하고 승인만 하면 됩니다.    │
│                                            │
│  [🚀 첫 파이프라인 만들기]  (크고 넓은 CTA)│
│                                            │
│     또는 템플릿으로 시작:                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │📝 코드    │ │🔍 분석    │ │📦 리팩토링│ │
│  │리뷰      │ │& 계획    │ │& 개선    │  │
│  └──────────┘ └──────────┘ └──────────┘  │
└────────────────────────────────────────────┘
```

### EmptyState 컴포넌트 Props 및 구현

```typescript
// src/components/dashboard/empty-state.tsx
interface EmptyStateProps {
  onCreatePipeline: () => void;
  onSelectTemplate: (templateId: string) => void;
}
```

- 컨테이너: `flex flex-col items-center justify-center h-full max-w-2xl mx-auto px-6 text-center`
- 아이콘: lucide `Music` (지휘자 메타포), `size-12 text-muted-foreground mb-6`
- 제목: `text-2xl font-semibold tracking-tight mb-2`
- 설명: `text-base text-muted-foreground mb-8 max-w-md` — 3문장 이내 (Cowan 청킹)
- CTA: `<Button size="lg" className="w-full max-w-xs mb-8">` → `/pipelines/new` 이동
- 구분선: `text-sm text-muted-foreground mb-4` "또는 템플릿으로 시작:"
- 템플릿 그리드: `grid grid-cols-1 sm:grid-cols-3 gap-4 w-full`

### TemplateCard 컴포넌트 Props 및 구현

```typescript
// src/components/dashboard/template-card.tsx
interface TemplateCardProps {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  agents: string[];
  mode: string;
  onClick: (id: string) => void;
}
```

- 3종 템플릿 데이터:

| id | title | icon | agents | mode |
|----|-------|------|--------|------|
| code-review | 코드 리뷰 | FileSearch | PM, Engineer, Reviewer | review |
| analysis | 분석 & 계획 | Search | PM, Engineer | plan_only |
| refactoring | 리팩토링 & 개선 | RefreshCw | Engineer, Reviewer | auto_edit |

- 카드: `group relative p-4 rounded-lg border border-border bg-card hover:border-primary/50 hover:shadow-md transition-all duration-150 cursor-pointer`
- 아이콘: `size-6 text-muted-foreground group-hover:text-primary transition-colors mb-3`
- 제목: `text-sm font-medium mb-1`
- 설명: `text-xs text-muted-foreground mb-3`
- 에이전트 표시: `flex items-center gap-1.5 text-xs text-muted-foreground` — "PM → Engineer → Reviewer" 형태
- 카드 클릭: `role="button" tabIndex={0}` + `aria-label="{title} 템플릿으로 시작"`
- Enter/Space 키로도 동작

### 상태별 처리

| 상태 | 표시 |
|------|------|
| Loading | Skeleton: 아이콘 영역 + 텍스트 3줄 + 카드 3개 (animate-pulse) |
| Error | 빨간 배너 `bg-destructive/10 border border-destructive text-destructive` + 재시도 버튼 |
| Empty (기본) | 위 레이아웃 그대로 |

### 접근성
- EmptyState 컨테이너: `role="status" aria-label="시작 안내"`
- 각 TemplateCard: `role="button" tabIndex={0} aria-label="{title} 템플릿으로 시작"`
- CTA 버튼: `aria-label="첫 파이프라인 만들기"`
- Tab 순서: CTA 버튼 → 템플릿 카드 1 → 2 → 3

### 품질 기준
- 모바일: 템플릿 카드 세로 스택 (grid-cols-1)
- 다크모드: bg-card, text-foreground 등 시맨틱 토큰만 사용
- 제목/설명 텍스트가 길어져도 레이아웃 깨지지 않음
```

---

### TASK 2.3: [BE] 대시보드 API 강화 + 템플릿 API

**담당**: 시니어 개발자
**의존성**: 없음 (기존 API 위에 구축)
**산출물**: 강화된 pipelines API, 새 templates API, preset_templates 테이블

#### 프롬프트

```
## CONTEXT
{SECTION 0 전체 삽입}

## TASK: 대시보드 + 템플릿 API 구현

### 1. GET /api/pipelines 강화

현재 `src/app/api/pipelines/route.ts`의 GET은 단순 목록 조회입니다.
Sprint 1 대시보드 요구사항에 맞게 강화하세요.

**요구사항**:
- 쿼리 파라미터: `status` (running|completed|failed|all, default: all), `limit` (default: 10), `offset` (default: 0)
- 응답에 agents 수와 상태 요약 포함
- 정렬: 실행 중(running) 우선, 그 다음 updated_at DESC
- 최신 세션의 token_usage/token_limit 포함

**응답 구조**:
```typescript
interface PipelineSummary {
  id: string;
  title: string;
  description: string | null;
  status: PipelineStatus;
  mode: PipelineMode;
  created_at: string;
  updated_at: string;
  agent_summary: {
    total: number;
    active: number;
    completed: number;
    roles: AgentRole[];
  };
  latest_session: {
    id: string;
    status: SessionStatus;
    token_usage: number;
    token_limit: number;
    progress_percent: number;
  } | null;
}
```

**구현 방식**:
```typescript
// Supabase 쿼리 — 필요한 컬럼만 select
const { data, error } = await supabase
  .from("pipelines")
  .select(`
    id, title, description, status, mode, created_at, updated_at,
    agents(id, role),
    sessions(id, status, token_usage, token_limit)
  `)
  .eq("user_id", user.id)
  .order("status", { ascending: true })  // running 먼저
  .order("updated_at", { ascending: false })
  .range(offset, offset + limit - 1);
```

### 2. 템플릿 시스템 구현

**2a. DB 마이그레이션** — `supabase/migrations/00004_preset_templates.sql`

```sql
CREATE TABLE public.preset_templates (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT NOT NULL DEFAULT 'FileSearch',
  config JSONB NOT NULL DEFAULT '{}',
  is_preset BOOLEAN DEFAULT true,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 프리셋 3종 시드
INSERT INTO public.preset_templates (id, title, description, icon, config, is_preset) VALUES
('code-review', '코드 리뷰', 'PR 단위 코드 리뷰 자동화', 'FileSearch',
 '{"agents": [{"role": "pm"}, {"role": "engineer"}, {"role": "reviewer"}], "mode": "review"}', true),
('analysis', '분석 & 계획', '코드베이스 분석 후 실행 계획 수립', 'Search',
 '{"agents": [{"role": "pm"}, {"role": "engineer"}], "mode": "plan_only"}', true),
('refactoring', '리팩토링 & 개선', '기존 코드 자동 리팩토링', 'RefreshCw',
 '{"agents": [{"role": "engineer"}, {"role": "reviewer"}], "mode": "auto_edit"}', true);

-- RLS
ALTER TABLE public.preset_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view presets"
  ON public.preset_templates FOR SELECT
  USING (is_preset = true OR user_id = auth.uid());

CREATE POLICY "Users can create own templates"
  ON public.preset_templates FOR INSERT
  WITH CHECK (user_id = auth.uid() AND is_preset = false);
```

**2b. 타입 정의** — `src/types/template.ts`

```typescript
export interface PresetTemplate {
  id: string;
  title: string;
  description: string | null;
  icon: string;
  config: {
    agents: { role: string; instruction?: string }[];
    mode: string;
  };
  is_preset: boolean;
  user_id: string | null;
  created_at: string;
}
```

**2c. API 라우트** — `src/app/api/templates/route.ts`

GET /api/templates:
- 프리셋(is_preset=true) + 사용자 커스텀(user_id = currentUser) 조회
- 응답: `{ presets: PresetTemplate[], custom: PresetTemplate[] }`

POST /api/templates:
- 사용자 커스텀 템플릿 저장
- body 검증: title(필수, 1-100자), config(필수, agents 배열 포함)
- is_preset=false, user_id=currentUser 자동 설정

### 3. GET /api/history 강화

현재 placeholder입니다. 실제 구현하세요.

- `src/app/api/history/route.ts`
- 쿼리 파라미터: `status` (completed|failed|all), `search` (title 검색), `limit`, `offset`
- pipeline_history 테이블에서 조회
- 정렬: created_at DESC

### 구현 시 반드시 지킬 것
1. 기존 `src/lib/api/auth.ts`의 `getAuthenticatedUser()` 사용
2. 기존 `src/lib/api/response.ts`의 successResponse/errorResponse 사용
3. 기존 `src/lib/api/errors.ts`의 Errors factory 사용 (Errors.badRequest, Errors.notFound 등)
4. try/catch 블록에서 handleError() 사용
5. 입력 검증 실패 시 400 Bad Request
6. Route Params 타입: `{ params: Promise<{ id: string }> }`
```

---

### TASK 2.4: [BE] Realtime 구독 훅 구현

**담당**: 시니어 개발자
**의존성**: 없음
**산출물**: usePipelineRealtime 훅, Zustand 스토어

#### 프롬프트

```
## CONTEXT
{SECTION 0 전체 삽입}

## TASK: Realtime 구독 훅 + Zustand 스토어 구현

### 사전 작업: 패키지 설치

```bash
source ~/.nvm/nvm.sh && nvm use 22
cd /Users/choeseung-won/personal-project/claudeDevelopmentSystem
npm install zustand framer-motion
```

### 1. Zustand 파이프라인 스토어

`src/stores/pipeline-store.ts`:

```typescript
import { create } from 'zustand';
import type { Pipeline } from '@/types/pipeline';
import type { Session } from '@/types/session';
import type { Agent } from '@/types/agent';

interface PipelineSummary {
  pipeline: Pipeline;
  agents: Agent[];
  latestSession: Session | null;
}

interface PipelineStore {
  pipelines: PipelineSummary[];
  isLoading: boolean;
  error: string | null;

  setPipelines: (pipelines: PipelineSummary[]) => void;
  updatePipeline: (id: string, updates: Partial<Pipeline>) => void;
  updateSession: (pipelineId: string, session: Session) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}
```

- immer 미들웨어 불필요 — 얕은 업데이트로 충분
- devtools 미들웨어 추가 (개발 모드에서 디버깅 용도)

### 2. Realtime 구독 훅

`src/hooks/use-pipeline-realtime.ts`:

```typescript
"use client";

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { usePipelineStore } from '@/stores/pipeline-store';

export function usePipelineRealtime(userId: string) {
  const { updatePipeline, updateSession } = usePipelineStore();

  useEffect(() => {
    const supabase = createClient();

    // pipelines 테이블 UPDATE 구독
    const pipelineChannel = supabase
      .channel('pipeline-changes')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'pipelines',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        updatePipeline(payload.new.id, payload.new);
      })
      .subscribe();

    // sessions 테이블 UPDATE 구독
    const sessionChannel = supabase
      .channel('session-changes')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'sessions',
      }, (payload) => {
        updateSession(payload.new.pipeline_id, payload.new);
      })
      .subscribe();

    // Cleanup
    return () => {
      supabase.removeChannel(pipelineChannel);
      supabase.removeChannel(sessionChannel);
    };
  }, [userId, updatePipeline, updateSession]);
}
```

### 3. 데이터 페치 훅

`src/hooks/use-pipelines.ts`:

```typescript
"use client";

// 초기 데이터 로드 + Realtime 구독을 결합하는 훅
// fetch는 API route 호출, 이후 Realtime으로 자동 업데이트
```

구현 요구사항:
- 초기 로드: `/api/pipelines?status=all&limit=10` fetch
- 로드 완료 후 스토어에 저장
- usePipelineRealtime 호출로 실시간 업데이트
- 에러 발생 시 3초 후 자동 재시도 (최대 3회)
- 컴포넌트 언마운트 시 구독 정리

### 연결 끊김 대응
- Supabase channel의 `system` 이벤트 구독
- CHANNEL_ERROR 시 3초 후 재연결 시도
- reconnect 로직을 훅 내부에 캡슐화

### 품질 기준
- "use client" 선언 필수
- useEffect cleanup에서 반드시 채널 제거
- 타입 안전: payload.new에 대한 타입 가드
- 불필요한 리렌더링 방지: selector 패턴 사용
```

---

## SECTION 3: PHASE 2 — 순차 작업 (Day 2-3)

> Phase 1 완료 후 실행. FE-1.2 → FE-1.3 순차 진행.
> 이 시점에서 API가 준비되어 있으므로 실제 데이터 연동 가능.

---

### TASK 3.1: [FE] 활성 파이프라인 카드 구현

**담당**: 프론트엔드 개발자
**의존성**: TASK 2.1 (레이아웃), TASK 2.3 (API), TASK 2.4 (스토어)
**산출물**: PipelineCard.tsx, 대시보드 메인 페이지 통합

#### 프롬프트

```
## CONTEXT
{SECTION 0 전체 삽입}

## TASK: 활성 파이프라인 요약 카드 구현

파이프라인이 1개 이상 존재할 때 EmptyState 대신 표시되는 활성 대시보드를 구현합니다.

### 생성/수정할 파일

1. `src/components/dashboard/pipeline-card.tsx` — 개별 카드
2. `src/components/dashboard/pipeline-list.tsx` — 카드 리스트 + 헤더
3. `src/components/dashboard/dashboard-content.tsx` — 상태 분기 (Empty vs Active)
4. `src/app/(dashboard)/page.tsx` — 수정 (DashboardContent 연결)

### PipelineCard 레이아웃

```
┌───────────────────────────────────┐
│  🟢 코드 리뷰 파이프라인    [Running]  │
│                                   │
│  ● Engineer (68%)  ○ Reviewer      │
│  █████████▓░░░░░  68%             │
│                                   │
│  세션: 45%  │  3분 전 업데이트     │
└───────────────────────────────────┘
```

### PipelineCard Props

```typescript
interface PipelineCardProps {
  id: string;
  title: string;
  status: PipelineStatus;
  mode: PipelineMode;
  agents: { role: AgentRole; status: 'idle' | 'running' | 'completed' | 'error' }[];
  progress: number; // 0-100
  sessionUsage: number; // 0-100 (token_usage / token_limit * 100)
  updatedAt: string; // ISO timestamp
  onClick: (id: string) => void;
}
```

### 구현 상세

1. **카드 컨테이너**: shadcn `Card` 사용
   - `hover:shadow-md transition-shadow duration-200 cursor-pointer`
   - 클릭 → `/pipelines/[id]` 이동

2. **상태 Badge**: shadcn `Badge` 사용
   - Running: `bg-running/10 text-running border-running/30`
   - Completed: `bg-healthy/10 text-healthy border-healthy/30`
   - Failed: `bg-critical/10 text-critical border-critical/30`
   - Paused: `bg-warning/10 text-warning border-warning/30`

3. **에이전트 표시**: 아바타 아이콘 + 상태 도트
   - 활성(running): `w-2 h-2 rounded-full bg-running animate-pulse`
   - 완료: `w-2 h-2 rounded-full bg-healthy`
   - 대기: `w-2 h-2 rounded-full bg-idle`
   - 에러: `w-2 h-2 rounded-full bg-critical`

4. **진행률 바**: shadcn `Progress`
   - 퍼센트 라벨 우측에 표시

5. **세션 게이지**: 미니 도트 + 퍼센트
   - 0-60%: `text-healthy`
   - 60-80%: `text-warning`
   - 80-90%: `text-danger`
   - 90-100%: `text-critical`

6. **시간 표시**: 상대 시간 ("3분 전") — 간단한 유틸 함수 구현

### PipelineList 구현

```typescript
interface PipelineListProps {
  pipelines: PipelineSummary[];
}
```

- 헤더: `flex items-center justify-between mb-6`
  - 좌: `text-lg font-semibold` "활성 파이프라인 {N}개"
  - 우: `<Button>` "새 파이프라인" → `/pipelines/new`
- 그리드: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`
- 카드 최대 4개 표시 (Cowan 4±1), 나머지는 "더보기" 버튼
- 정렬: running 상태 우선 → updated_at DESC

### DashboardContent 상태 분기

```typescript
export function DashboardContent() {
  // Zustand 스토어에서 데이터 가져오기
  const { pipelines, isLoading, error } = usePipelineStore(
    (s) => ({ pipelines: s.pipelines, isLoading: s.isLoading, error: s.error })
  );

  if (isLoading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} />;
  if (pipelines.length === 0) return <EmptyState ... />;
  return <PipelineList pipelines={pipelines} />;
}
```

### 반응형
- Desktop (lg): 3열 그리드
- Tablet (md): 2열 그리드
- Mobile: 1열 스택

### 접근성
- 카드: `article` 태그 + `aria-label="{title} - {status}"`
- 진행률: `role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}`
- 상태 도트: `aria-hidden="true"` (Badge 텍스트가 정보 전달)
- Tab으로 카드 간 이동, Enter로 선택
```

---

### TASK 3.2: [FE] 최근 히스토리 요약 섹션

**담당**: 프론트엔드 개발자
**의존성**: TASK 3.1
**산출물**: RecentHistory.tsx

#### 프롬프트

```
## CONTEXT
{SECTION 0 전체 삽입}

## TASK: 최근 히스토리 요약 섹션 구현

대시보드 하단에 최근 완료된 파이프라인 5개를 표시하는 섹션입니다.

### 생성할 파일

1. `src/components/dashboard/recent-history.tsx`

### 레이아웃

```
── 최근 완료 ───────────────────────────────
│  ✓ 결제 기능 추가           2시간 전       │
│  ✗ 검색 기능 리팩토링        어제          │
│  ✓ 로그인 버그 수정          2일 전        │
│  ✓ API 문서 업데이트          3일 전       │
│  ✓ 테스트 커버리지 개선       4일 전       │
│                                           │
│  [전체 보기 →]                             │
─────────────────────────────────────────────
```

### Props

```typescript
interface RecentHistoryProps {
  items: PipelineHistory[];
  onViewAll: () => void;
  onItemClick: (id: string) => void;
}
```

### 구현

- 섹션 구분: `<Separator className="my-8" />` 후 배치
- 헤더: `flex items-center justify-between mb-4`
  - 좌: `text-sm font-medium text-muted-foreground uppercase tracking-wider` "최근 완료"
  - 우: `text-sm text-primary hover:underline cursor-pointer` "전체 보기 →" → `/history`
- 각 항목: `flex items-center justify-between py-3 border-b border-border last:border-0`
  - 좌: 상태 아이콘 + 제목
    - 성공: `CheckCircle2 size-4 text-healthy`
    - 실패: `XCircle size-4 text-critical`
  - 우: 상대 시간 `text-xs text-muted-foreground`
- 빈 상태: "완료된 파이프라인이 없습니다" 텍스트
- 항목 클릭: hover `bg-accent/30 rounded-md px-2 -mx-2 transition-colors`

### 데이터 가져오기
- `/api/history?status=completed&limit=5` 또는 `/api/history?limit=5` fetch
- Server Component에서 직접 Supabase 쿼리도 가능

### 접근성
- 섹션: `section` + `aria-label="최근 완료된 파이프라인"`
- 각 항목: `button` 또는 `a` 태그 (클릭 가능하므로)
- "전체 보기": `Link` 컴포넌트 사용
```

---

## SECTION 4: PHASE 3 — 통합 + UX 검증 (Day 3)

---

### TASK 4.1: [UX] 전체 컴포넌트 UX/접근성 검증

**담당**: UX 디자이너
**의존성**: Phase 1, 2 전체
**산출물**: 수정 지시서 (코드 수정 포함)

#### 프롬프트

```
## CONTEXT
{SECTION 0 전체 삽입}

## TASK: Sprint 1 전체 UX/접근성 검증 및 수정

Phase 1-2에서 구현된 모든 컴포넌트를 인지과학 원칙에 따라 검증하고,
문제가 있으면 직접 코드를 수정하세요.

### 검증 대상 파일

1. `src/components/layout/sidebar.tsx`
2. `src/components/layout/topbar.tsx`
3. `src/components/dashboard/empty-state.tsx`
4. `src/components/dashboard/template-card.tsx`
5. `src/components/dashboard/pipeline-card.tsx`
6. `src/components/dashboard/pipeline-list.tsx`
7. `src/components/dashboard/recent-history.tsx`
8. `src/components/dashboard/dashboard-content.tsx`

### 검증 체크리스트 (파일별 수행)

#### A. 인지 부하 검증
- [ ] 한 화면 동시 정보 항목 ≤ 5 (Cowan 4±1)
- [ ] 선택지 수 ≤ 4 (Hick-Hyman)
- [ ] 불필요한 정보 없음 (외재적 부하 최소화)
- [ ] 청킹 적용됨 (관련 정보 그룹화)

#### B. 시각적 계층 검증
- [ ] 텍스트 크기 계층: display > h1 > h2 > body > caption
- [ ] 색상 계층: foreground > foreground-secondary > foreground-tertiary
- [ ] CTA가 시각적으로 가장 두드러짐
- [ ] 상태 정보 이중 인코딩 (색상 + 텍스트/아이콘)

#### C. 접근성 검증
- [ ] 모든 인터랙티브 요소에 aria-label 또는 가시 텍스트
- [ ] 활성 네비게이션에 aria-current="page"
- [ ] role 속성 올바름 (button, progressbar, status, navigation)
- [ ] Tab 순서 논리적 (좌→우, 위→아래)
- [ ] focus-visible 포커스 링 표시
- [ ] 색상 대비 WCAG AA (4.5:1 이상)

#### D. 반응형 검증
- [ ] Mobile (375px): 1열 레이아웃, 터치 타겟 44px+
- [ ] Tablet (768px): 2열, Sidebar 축소 가능
- [ ] Desktop (1280px): 3열, Sidebar 확장

#### E. 다크모드 검증
- [ ] 시맨틱 토큰만 사용 (하드코딩 색상 없음)
- [ ] 카드/배경 구분 가능
- [ ] 상태 색상 다크모드에서도 가시적

#### F. 애니메이션 검증
- [ ] duration ≤ 200ms (전환), ≤ 500ms (데이터 업데이트)
- [ ] prefers-reduced-motion 존중
- [ ] 입장 애니메이션 순차적 (staggerChildren 사용)

### 수정 시 원칙
1. 검증 결과를 코드에 직접 반영하세요
2. 추가 컴포넌트나 유틸이 필요하면 생성하세요
3. 수정 이유를 인지과학 근거와 함께 코드 주석이 아닌 커밋 메시지에 기록하세요
4. 대규모 구조 변경은 하지 마세요 — 기존 구조 내에서 개선
```

---

### TASK 4.2: [ALL] 통합 빌드 검증

**담당**: 시니어 개발자
**의존성**: TASK 4.1
**산출물**: 빌드 통과 확인

#### 프롬프트

```
## TASK: Sprint 1 통합 빌드 검증

### 실행 순서

1. 패키지 의존성 확인
```bash
source ~/.nvm/nvm.sh && nvm use 22
cd /Users/choeseung-won/personal-project/claudeDevelopmentSystem
npm install
```

2. TypeScript 타입 체크
```bash
npx tsc --noEmit
```
- strict 모드 에러 0개 필수

3. ESLint
```bash
npm run lint
```
- 에러 0개 필수, warning은 허용

4. 빌드
```bash
npm run build
```
- 빌드 성공 필수
- 콘솔에 에러/경고 없음

### 에러 발생 시
1. 에러 메시지를 분석하고 원인 파일을 수정하세요
2. import 경로, 타입 불일치, 미사용 변수 등을 확인하세요
3. 수정 후 다시 빌드하여 통과될 때까지 반복하세요
4. 빌드 통과 후 `npm run dev`로 개발 서버 실행하여 런타임 에러가 없는지 확인하세요
```

---

## SECTION 5: 작업 의존성 매트릭스

```
TASK 2.1 (Layout Shell)     ─┬─→ TASK 2.2 (Empty State) ─┐
                             │                            │
TASK 2.3 (API + Templates)   ─┤                            ├─→ TASK 3.1 (Pipeline Card) → TASK 3.2 (Recent History)
                             │                            │
TASK 2.4 (Realtime + Store) ─┘                            │
                                                          │
                                                          └─→ TASK 4.1 (UX Review) → TASK 4.2 (Build Verify)
```

**Phase 1 (병렬)**: TASK 2.1 + 2.3 + 2.4 동시 실행
**Phase 2 (순차)**: 2.1 완료 후 2.2 → 3.1 → 3.2 순차
**Phase 3 (검증)**: 모든 구현 완료 후 4.1 → 4.2

---

## SECTION 6: PM 오케스트레이션 체크리스트

### 에이전트 스폰 전

- [ ] 프로젝트 빌드 상태 확인 (`npm run build` 통과)
- [ ] 패키지 설치 완료 (zustand, framer-motion)
- [ ] Git 브랜치 생성 (`git checkout -b feat/sprint-1-dashboard`)

### Phase 1 스폰 시

- [ ] 프론트엔드 개발자 → TASK 2.1 할당
- [ ] 시니어 개발자 → TASK 2.3 + 2.4 할당 (순차 실행)
- [ ] 각 에이전트에게 SECTION 0 컨텍스트 전문 주입

### Phase 1 완료 확인

- [ ] TASK 2.1: (dashboard)/layout.tsx, sidebar.tsx, topbar.tsx 존재
- [ ] TASK 2.3: templates API, migration 파일 존재
- [ ] TASK 2.4: pipeline-store.ts, use-pipeline-realtime.ts 존재
- [ ] `npx tsc --noEmit` 에러 없음

### Phase 2 스폰 시

- [ ] 프론트엔드 개발자 → TASK 2.2 → 3.1 → 3.2 순차 할당
- [ ] Phase 1 결과물 경로를 컨텍스트에 추가

### Phase 3 스폰 시

- [ ] UX 디자이너 → TASK 4.1 할당 (모든 파일 목록 전달)
- [ ] 시니어 개발자 → TASK 4.2 할당

### 최종 확인

- [ ] `npm run build` 성공
- [ ] `npx tsc --noEmit` 에러 없음
- [ ] 라이트/다크 모드 정상
- [ ] 3개 뷰포트(Desktop/Tablet/Mobile) 정상
- [ ] Git commit + push
