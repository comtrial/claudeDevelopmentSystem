# v2 vs v3 PM Output 비교

## 실행 정보
| 항목 | v2 | v3 |
|------|----|----|
| System Prompt | 220 chars | 8760 chars |
| User Prompt | 654 chars | 1984 chars |
| 실행 시간 | 141.6s | 105.0s |
| 출력 길이 | 6011 chars | 4019 chars |
| max-turns | 10 | 15 |

## v2 출력 (첫 2000자)
```
이제 코드베이스를 충분히 파악했습니다. PM으로서 통합 분석 보고서를 작성합니다.

---

# PM 분석 보고서 — 3개 태스크 통합 계획

## 1. 현황 분석 (As-Is)

### Task 1 — Google OAuth
- `login-form.tsx`: 이메일/비밀번호 전용 UI (Google 버튼 없음)
- `/auth/callback/route.ts`: **이미 구현됨** — `exchangeCodeForSession()` + 대시보드 리다이렉트
- `middleware.ts` PUBLIC_ROUTES: `/auth/callback` 이미 포함
- **필요한 것**: Supabase 대시보드 Google Provider 활성화 + 로그인 폼 UI 추가만으로 충분

### Task 2 — 최근 활동 위젯
- `RecentHistory` 컴포넌트: **이미 존재** (`src/components/dashboard/recent-history.tsx`)
- `DashboardContent`에도 **이미 포함** (`<RecentHistory />` 렌더링 중)
- **문제점 1**: `if (pipelines.length === 0) return <EmptyState />` — 파이프라인이 없으면 RecentHistory가 렌더링되지 않음
- **문제점 2**: 현재 위젯에 상태 뱃지 없음 (아이콘만 있고 Badge 컴포넌트 미사용)
- **문제점 3**: `/api/history` → `pipeline_history` 테이블 조회 — 해당 테이블 존재 여부 확인 필요 (마이그레이션 파일 검토 대상)

### Task 3 — Rate Limiting
- `middleware.ts`: 현재 Supabase 세션 갱신만 처리, rate limiting 없음
- 로컬 실행 환경 (`localhost:3000`) → Redis 불필요, **인메모리 Map으로 충분**
- `/api/*` 전체 라우트 대상, `/auth/callback`은 제외 대상 (OAuth 흐름 차단 방지)

---

## 2. 의존성 맵

```
Task 3 (Rate Limiting)
  └─ middleware.ts 수정
       └─ Task 1의 /auth/callback 경로 exclusion 필요 (약한 의존)

Task 1 (Google OAuth)        Task 2 (최근 활동 위젯)
  └─ login-form.tsx 독립적     └─ DashboardContent 로직 수정
                               └─ RecentHistory 컴포넌트 수정
```

**Task 3 → Task 1 순서 권장**: middleware 수정 시 OAuth callback 경로를 rate limit 제외 목록에 넣어야 하므로, Task 3를 먼저 설계해두면 Task 1 통합이 깔끔함.

---

## 3. 우선순위 및 실행 순서

| 순서 | 태스크 | 이유 |
|------|--------|------|
| 1 | **Task 3 — Rate Limiting** | 보안 인프라 선행. middleware 수정이 Task 1에 영향 |
| 2 | **Task 1 — Google OAuth** | 사용자 접근 방식 변경, UX 핵심 기능 |
| 3 | **Task 2 — 최근 활동 위젯** | 대부분 구현됨, 버그 수정 + 개선 수준 |

---

## 4. 상세 스펙 정의

---

### [SPEC-1] Task 3: API Rate Limiting 미들웨어

**목표**: 모든 `/api/*` 라우트에 IP 기반 분당 60회 제한 적용

**구현 위치**: `src/middleware.ts` (기존 `updateSession` 호출 앞에 삽입)

**상세 스펙**:

```
알고리즘: Fixed Window Counter (1분 단위)
저장소: module-level Map<string, {count: number, resetAt: number}>
키: X-Forwarded-For 헤더 || requ
```

## v3 출력 (첫 2000자)
```
파일 분석 완료. 이제 플랜을 작성하겠습니다.

---

## Step 1: Holistic Analysis

**발견된 주요 사실들:**
- Task 2의 `RecentHistory` 컴포넌트가 **이미 존재**하며 대시보드에 렌더링 중 (`/api/history?limit=5`). 단, 상태 배지(Badge) 없이 아이콘만 사용, completed/failed만 표시
- Task 1의 `/auth/callback/route.ts`가 **이미 존재**하며 OAuth code 교환 로직 구현됨 (Google OAuth 거의 준비된 상태)
- Task 3: 현재 미들웨어는 Supabase 세션만 처리. rate limiting 라이브러리 없음 (`package.json` 확인)

---

## Step 2: Dependency Graph

```
Task 1 (Google OAuth)  ──────────────────────── 독립
Task 2 (최근 활동 위젯) ─────────────────────── 독립 (RecentHistory 수정 또는 신규)
Task 3 (Rate Limiting) ──→ middleware.ts 수정 ── 독립
```

상호 의존성 없음. 3개 병렬 실행 가능.

---

## Step 3: Risk Assessment

| Task | 위험도 | 이유 |
|------|--------|------|
| Task 1 | **Low** | callback route 이미 존재. `signInWithOAuth` 한 줄 + 버튼 UI만 추가 |
| Task 2 | **Low** | RecentHistory 이미 존재하나 상태 배지 없음. 기존 컴포넌트 수정으로 충분 |
| Task 3 | **Medium** | Next.js 미들웨어는 Edge Runtime — `Map` 기반 인메모리는 단일 워커에서만 유효, 재시작 시 초기화됨. 로컬 전용 앱이므로 허용 |

---

## Step 4: Task Specifications

---

## Task 1: 로그인 페이지에 Google OAuth 추가
- **목표**: 기존 이메일 로그인을 유지하면서 Google OAuth 버튼 추가. Supabase OAuth 플로우 활용.
- **수정 파일**:
  1. `src/hooks/use-auth.ts` — `signInWithGoogle()` 함수 추가
  2. `src/components/auth/login-form.tsx` — 구분선 + Google 버튼 추가
- **구현 단계**:
  1. `use-auth.ts`: `signInWithGoogle` 추가 — `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: '{origin}/auth/callback' } })`
  2. `login-form.tsx`: `useAuth`에서 `signInWithGoogle` 구조 분해
  3. `CardFooter` 내 기존 로그인 버튼 아래에 구분선(`<Separator />` 또는 `<div>또는</div>`) 추가
  4. Google 버튼 추가 — `variant="outline"`, `w-full`, Google SVG 아이콘 또는 `lucide-react` 없으면 텍스트만
- **검증 방법**: 로그인 페이지에서 Google 버튼 클릭 → Google OAuth 동의 화면 리다이렉트 확인. 이메일 로그인 여전히 동작 확인.
- **의존성**: 없음 (Supabase Dashboard에서 Google provider 활성화는 외부 설정)
- **위험도**: Low — callback route 이미 존재, API 변경 없음

---

## Task 2: 대시보드 최근 활동 위젯 추가
- **목표**: 기존 `RecentHistory`는 completed/failed만 표시하고 아이콘만 사용. 모든 상태를 포함하는 상태 배지(Badge) 위젯으로 개선.
- **수정 파일**:
  1. `src/components
```
