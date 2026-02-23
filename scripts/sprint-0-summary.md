# Sprint 0 — 프로젝트 기반 구축 완료 보고서

> **완료일**: 2026-02-23
> **브랜치**: `develop`
> **커밋**: `feat: Sprint 0 — 프로젝트 기반 구축` + `fix: update supabase config for CLI v2.75 compatibility`

---

## 1. 배포 상태

| 항목 | 상태 | URL/정보 |
|------|------|----------|
| GitHub | `develop` 브랜치 push 완료 | `git@github.com:comtrial/claudeDevelopmentSystem.git` |
| Vercel | Production 배포 성공 | https://claude-dev-system.vercel.app |
| Supabase | 마이그레이션 3개 적용 완료 | Project Ref: `smspuulcqydmminkuwus` |
| 빌드 | 25 routes, 0 TS errors | Next.js 16.1.6 Turbopack |

### Vercel 환경변수 (production/preview/development 모두 설정)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### 배포 검증
- `/` → 307 리다이렉트 (미들웨어 인증 가드 → `/login`)
- `/api/settings` → 401 (인증 필요 — 정상 동작)

---

## 2. 기술 스택 (확정)

| 항목 | 버전/도구 |
|------|----------|
| Runtime | Node.js v22 (`source ~/.nvm/nvm.sh && nvm use 22`) |
| Framework | Next.js 16.1.6 (App Router, Turbopack, TypeScript strict) |
| React | 19.2.3 |
| Styling | Tailwind CSS v4 + `@theme inline` + tw-animate-css |
| UI Kit | shadcn/ui (New York style, Neutral base) — 21 components |
| Icons | lucide-react v0.575 |
| Toast | Sonner (via shadcn) |
| Theme | next-themes (class strategy, system default) |
| Fonts | Inter (sans) + JetBrains Mono (code) via next/font/google |
| Backend | Supabase (PostgreSQL 17, Realtime, RLS, SSR) |
| State | Zustand (persist + devtools middleware) |
| Package Manager | npm |

---

## 3. 완료된 태스크

### FE-0.1: 프로젝트 초기 셋업
- Next.js 16.1.6 프로젝트 생성 (App Router, TypeScript, Tailwind v4)
- tsconfig.json, eslint.config.mjs, postcss.config.mjs 설정
- `.env.local.example` 환경변수 템플릿

### FE-0.2: shadcn/ui + 디자인 토큰
- shadcn/ui 21개 컴포넌트 설치
- `globals.css`에 Apple Design Language 기반 디자인 토큰 정의
  - 상태 색상: `--healthy`, `--warning`, `--danger`, `--critical`, `--idle`, `--running`
  - 에이전트 색상: `--agent-pm`, `--agent-engineer`, `--agent-reviewer`, `--agent-designer`, `--agent-analyst`, `--agent-qa`, `--agent-devops`, `--agent-security`
  - 레이아웃: `--sidebar-width(256px)`, `--sidebar-collapsed-width(64px)`, `--topbar-height(56px)`
  - 배경/텍스트/테두리 시맨틱 토큰 (light/dark)

### FE-0.3: 전역 레이아웃 및 네비게이션
- `(dashboard)` 라우트 그룹 + AppShell 레이아웃
- Sidebar (w-60/w-16 접기/펼치기, `transition-[width] duration-200 ease-in-out`)
- Topbar (pathname 기반 동적 제목, 다크모드 토글)
- MobileNav (Sheet 오버레이, md 미만)
- nav-config.ts (mainNavItems/bottomNavItems/pageTitles 분리)
- sidebar-nav-item.tsx (exact 매칭, hover/active 스타일)
- user-menu.tsx (Avatar + DropdownMenu, 접힘시 Tooltip)
- 모든 placeholder 라우트 페이지 생성

### FE-0.4: Supabase 클라이언트 및 인증
- `src/lib/supabase/client.ts` — createBrowserClient
- `src/lib/supabase/server.ts` — createServerClient (cookies)
- `src/lib/supabase/middleware.ts` — session refresh + 인증 가드
- `src/hooks/use-auth.ts` — signIn/signUp/signOut + auth-store 연동
- `src/components/auth/login-form.tsx` — Card+Input+Button, Loader2, 에러 핸들링
- `src/components/auth/signup-form.tsx` — 6자 비밀번호 검증
- `(auth)` 라우트 그룹 (login/signup) + 센터 정렬 레이아웃
- `src/app/auth/callback/route.ts` — OAuth/Magic Link 콜백

### FE-0.5: Zustand 상태 관리
- `src/stores/auth-store.ts` — user/isAuthenticated, setUser/clearUser
- `src/stores/ui-store.ts` — sidebarCollapsed/theme, persist middleware
- `src/stores/pipeline-store.ts` — activePipelines/currentPipeline, devtools middleware

### FE-0.6: WebSocket 연결 훅 및 프로바이더
- `src/hooks/use-websocket.ts` — Supabase Realtime 구독, exponential backoff (1s→30s, 25% jitter, max 5 retries)
- `src/components/providers/websocket-provider.tsx` — React Context for status/send/reconnect
- `src/types/websocket.ts` — ConnectionStatus, WebSocketMessage 타입
- `src/hooks/use-notifications.ts` — Sonner 기반 WebSocket 알림
- `src/components/providers/notification-provider.tsx` — Toaster 래핑

### BE-0.1: Supabase DB 스키마
- `00001_initial_schema.sql` — 9 테이블:
  - profiles, pipelines, tasks, agents, sessions
  - agent_logs, code_changes, pipeline_history, user_settings
- 9 인덱스 (status, user_id, pipeline_id 등)
- RLS 정책 (사용자별 데이터 격리)
- updated_at 자동 갱신 트리거

### BE-0.2: 인증 시스템 및 프로필 트리거
- `00002_auth_trigger.sql` — `handle_new_user()` 트리거
  - 회원가입 시 profiles + user_settings 자동 생성

### BE-0.3: API 라우트 구조 + Realtime
- `00003_realtime.sql` — agent_logs, sessions, pipelines publication
- 13개 API 라우트 (인증 가드 + successResponse/errorResponse 패턴):

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/api/pipelines` | GET, POST | 파이프라인 목록/생성 |
| `/api/pipelines/[id]` | GET, PATCH, DELETE | 단건 CRUD |
| `/api/pipelines/[id]/execute` | POST | 실행 (placeholder) |
| `/api/pipelines/[id]/sessions` | GET | 세션 목록 |
| `/api/pipelines/parse` | POST | NLP 파싱 (placeholder) |
| `/api/pipelines/clone` | POST | 복제 (placeholder) |
| `/api/sessions/[id]` | GET | 세션 상세 |
| `/api/sessions/[id]/logs` | GET | 로그 (필터 지원) |
| `/api/sessions/[id]/changes` | GET, PATCH | 코드 변경 |
| `/api/history` | GET | 히스토리 (검색/필터) |
| `/api/history/[id]` | GET | 히스토리 상세 |
| `/api/settings` | GET, PATCH | 사용자 설정 |
| `/api/settings/test-key` | POST | API 키 검증 |

---

## 4. 파일 구조

```
src/
├── app/
│   ├── (auth)/
│   │   ├── layout.tsx              # 센터 정렬 인증 레이아웃
│   │   ├── login/page.tsx          # 로그인 (Suspense + LoginForm)
│   │   └── signup/page.tsx         # 회원가입
│   ├── (dashboard)/
│   │   ├── layout.tsx              # AppShell (Sidebar + Topbar)
│   │   ├── dashboard/page.tsx      # 대시보드 홈 (placeholder)
│   │   ├── pipelines/
│   │   │   ├── page.tsx            # 파이프라인 목록
│   │   │   ├── new/page.tsx        # 새 파이프라인
│   │   │   └── [id]/
│   │   │       ├── monitor/page.tsx
│   │   │       └── review/page.tsx
│   │   ├── history/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   └── settings/page.tsx
│   ├── api/                        # 13개 API 라우트
│   ├── auth/callback/route.ts      # Supabase OAuth 콜백
│   ├── globals.css                 # 디자인 토큰 (light/dark)
│   ├── layout.tsx                  # Root (fonts, ThemeProvider, TooltipProvider)
│   └── page.tsx                    # redirect("/dashboard")
├── components/
│   ├── auth/                       # login-form, signup-form
│   ├── layout/                     # app-shell, sidebar, topbar, mobile-nav, etc.
│   ├── providers/                  # websocket-provider, notification-provider
│   ├── theme-provider.tsx          # next-themes
│   └── ui/                         # shadcn/ui 21개 컴포넌트
├── hooks/
│   ├── use-auth.ts                 # signIn/signUp/signOut
│   ├── use-notifications.ts        # Sonner 알림
│   ├── use-sidebar.ts              # sidebar 상태
│   └── use-websocket.ts            # Supabase Realtime
├── lib/
│   ├── api/                        # auth, errors, response 유틸
│   ├── supabase/                   # client, server, middleware
│   ├── websocket/client.ts         # Realtime 구독 유틸
│   └── utils.ts                    # cn() (clsx + tailwind-merge)
├── stores/
│   ├── auth-store.ts               # 인증 상태
│   ├── pipeline-store.ts           # 파이프라인 상태
│   └── ui-store.ts                 # UI 상태 (persist)
├── types/
│   ├── api.ts                      # ApiResponse, PaginatedResponse
│   ├── agent.ts                    # Agent, AgentLog, AgentRole
│   ├── pipeline.ts                 # Pipeline, Task, CodeChange, etc.
│   ├── session.ts                  # Session, Profile, UserSettings
│   └── websocket.ts                # ConnectionStatus, WebSocketMessage
└── middleware.ts                    # 인증 가드 (updateSession)

supabase/
├── config.toml                     # DB v17, API/Auth/Storage 설정
└── migrations/
    ├── 00001_initial_schema.sql    # 9 tables, indexes, RLS
    ├── 00002_auth_trigger.sql      # 프로필 자동 생성
    └── 00003_realtime.sql          # Realtime publication
```

---

## 5. 디자인 시스템 토큰 요약 (globals.css)

### 상태 색상 (HSL)
| 토큰 | Light | 용도 |
|------|-------|------|
| `--healthy` | 142 71% 45% | 성공/완료 |
| `--warning` | 38 92% 50% | 경고 |
| `--danger` | 25 95% 53% | 위험 |
| `--critical` | 0 84% 60% | 치명적 |
| `--idle` | 220 9% 46% | 대기 |
| `--running` | 217 91% 60% | 실행중 |

### 에이전트 색상
| 토큰 | 역할 |
|------|------|
| `--agent-pm` | PM (보라) |
| `--agent-engineer` | 엔지니어 (파랑) |
| `--agent-reviewer` | 리뷰어 (초록) |
| `--agent-designer` | 디자이너 (분홍) |
| `--agent-analyst` | 분석가 (주황) |
| `--agent-qa` | QA (청록) |
| `--agent-devops` | DevOps (노랑) |
| `--agent-security` | 보안 (빨강) |

---

## 6. API 패턴 (Sprint 1에서 따를 것)

```typescript
// 인증
const { supabase, user } = await getAuthenticatedUser();

// 성공 응답
return NextResponse.json(successResponse(data));

// 에러 응답
return NextResponse.json(
  errorResponse("메시지", "ERROR_CODE", 400),
  { status: 400 }
);

// catch 블록
const { body, status } = handleError(error);
return NextResponse.json(body, { status });

// Route Params (Next.js 16)
type Params = { params: Promise<{ id: string }> };
```

---

## 7. DB 스키마 요약

### 핵심 테이블
| 테이블 | 주요 컬럼 | 비고 |
|--------|----------|------|
| profiles | id (FK auth.users), email, display_name, avatar_url | 자동 생성 |
| pipelines | user_id, title, status, mode, config | RLS |
| tasks | pipeline_id, title, type, status, order_index | 순서 보장 |
| agents | pipeline_id, role, instruction, model | PM/Engineer/Reviewer |
| sessions | pipeline_id, status, token_usage, token_limit | 토큰 추적 |
| agent_logs | session_id, agent_id, level, message | Realtime |
| code_changes | session_id, file_path, diff, status | approved/rejected |
| pipeline_history | pipeline_id, summary, total_tokens, total_duration_sec | 실행 이력 |
| user_settings | user_id, theme, notification_preferences, api_keys | JSONB |

### 인덱스
- pipelines: `(user_id, status)`, `(user_id, updated_at DESC)`
- sessions: `(pipeline_id, started_at DESC)`
- agent_logs: `(session_id, created_at)`, `(agent_id)`
- tasks: `(pipeline_id, order_index)`
- code_changes: `(session_id)`

### Realtime Publication
- `agent_logs`, `sessions`, `pipelines` 테이블 변경사항 실시간 구독 가능

---

## 8. 알려진 이슈 / Sprint 1 참고사항

1. **Next.js 16 middleware deprecation**: `middleware.ts`는 deprecated, `proxy` 컨벤션으로 전환 권장 (기능 영향 없음)
2. **로컬 빌드 ENOENT**: macOS에서 Turbopack 빌드 시 간헐적 `.next/turbopack` ENOENT 발생 — Vercel 서버에서는 정상 빌드
3. **Sprint 1 패키지 설치 필요**: `zustand`는 설치되어 있으나, `framer-motion`은 미설치 (Sprint 1에서 설치)
4. **Placeholder API**: parse, clone, execute 라우트는 skeleton 상태 — Sprint 1+에서 실제 로직 구현 필요
5. **sidebar hook**: `use-sidebar.ts`에 커스텀 훅 존재 — zustand ui-store와 통합 고려
6. **Supabase 프로젝트 공유**: sequeliquance 프로젝트와 동일 Supabase 인스턴스 사용 중 — 필요시 분리 고려
