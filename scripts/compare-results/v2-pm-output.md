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
키: X-Forwarded-For 헤더 || request.ip || "unknown"
제한: 60회/분
적용 경로: /api/** (pathname.startsWith("/api"))
제외 경로: /auth/callback (OAuth flow 보호)
```

**응답 스펙**:
```
HTTP 429 Too Many Requests
헤더:
  Retry-After: <남은 초>
  X-RateLimit-Limit: 60
  X-RateLimit-Remaining: 0
  X-RateLimit-Reset: <Unix timestamp>
Body: { data: null, error: { message: "Too many requests", code: "RATE_LIMITED" }, status: 429 }
```

**주의사항**:
- `src/middleware.ts`의 `export const config.matcher`가 이미 API 경로를 포함하고 있어 별도 matcher 변경 불필요
- 인메모리 방식이므로 서버 재시작 시 카운터 리셋 (로컬 환경에서 허용 가능)
- `updateSession()` 성공 후 rate limit 응답 시 Supabase 쿠키 갱신이 이미 된 상태 → rate limit 체크를 `updateSession()` 호출 **이전**에 수행해야 불필요한 Supabase 호출 방지

**수정 파일**: `src/middleware.ts` (단독)

---

### [SPEC-2] Task 1: Google OAuth 로그인 버튼

**목표**: 기존 이메일/비밀번호 플로우를 유지하며 Google OAuth 버튼 추가

**Supabase 사전 조건** (엔지니어가 Supabase 대시보드에서 직접 설정):
1. Authentication > Providers > Google 활성화
2. Google Cloud Console에서 OAuth 2.0 클라이언트 생성
3. Authorized redirect URI: `http://localhost:3000/auth/callback`
4. Client ID / Secret → Supabase에 입력

**구현 스펙** (`src/components/auth/login-form.tsx`):

```
UI 배치:
  [기존 로그인 버튼]
  ── 또는 ──
  [Google로 계속하기 버튼]  ← 새로 추가

Google 버튼:
  - variant="outline", w-full, min-h-[44px]
  - 로딩 중 disabled (기존 email 로딩과 공유)
  - 아이콘: lucide-react의 Chrome 없음 → SVG 인라인 또는 간단한 "G" 텍스트 처리
```

**API 호출 스펙**:
```typescript
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: "google",
  options: {
    redirectTo: `${window.location.origin}/auth/callback`,
  },
});
```

**에러 처리**: 기존 `setError()` 상태를 재사용, Google 오류 메시지를 한국어로 표시

**주의사항**:
- `signInWithOAuth()`는 리다이렉트 방식 → `async/await`로 에러만 잡고, 성공 시 자동 페이지 이동
- 기존 `handleSubmit`의 `loading` 상태를 Google 버튼에도 적용하여 중복 클릭 방지
- `/auth/callback`은 이미 `next` param으로 `/dashboard` 리다이렉트 구현됨 → 추가 작업 불필요

**수정 파일**: `src/components/auth/login-form.tsx` (단독)

---

### [SPEC-3] Task 2: 최근 활동 위젯 버그 수정 + 개선

**목표**: 기존 구현의 2가지 문제 수정 + 상태 뱃지 추가

#### 수정 1: EmptyState에서도 RecentHistory 표시

**수정 위치**: `src/components/dashboard/dashboard-content.tsx`

**현재 코드 문제**:
```typescript
if (pipelines.length === 0) return <EmptyState />;  // ← RecentHistory 미표시
```

**수정 방향**:
```typescript
// pipelines가 없어도 RecentHistory는 항상 표시
return (
  <div className="space-y-6 sm:space-y-8">
    {pipelines.length === 0 ? <EmptyState /> : <PipelineList pipelines={pipelines} />}
    <RecentHistory />
  </div>
);
```

#### 수정 2: 상태 뱃지 추가

**수정 위치**: `src/components/dashboard/recent-history.tsx`

**현재**: 아이콘(CheckCircle2/XCircle)만 있고 Badge 컴포넌트 없음  
**추가**: `Badge` 컴포넌트로 상태 텍스트 표시

```
completed → Badge "완료" (bg-healthy/10 text-healthy)
failed    → Badge "실패" (bg-critical/10 text-critical)
cancelled → Badge "취소" (기본 secondary)
```

#### 수정 3: `/api/history` 응답 타입 확인

**현재**: `pipeline_history` 테이블 조회 → `PipelineHistory` 타입 반환  
**확인 필요**: `pipeline_history` 테이블/뷰가 마이그레이션에 실제 존재하는지 확인 (`supabase/migrations/` 검토)  
만약 테이블이 없다면 → `/api/pipelines/history?limit=5`로 엔드포인트 변경 고려

**수정 파일**:
- `src/components/dashboard/dashboard-content.tsx`
- `src/components/dashboard/recent-history.tsx`
- (조건부) `src/app/api/history/route.ts` 또는 엔드포인트 교체

---

## 5. 리스크 및 주의사항

| 리스크 | 내용 | 완화 방안 |
|--------|------|-----------|
| Rate Limit 오탐 | 개발 중 localhost에서 60회 금방 소진 | `/api/` 이외 경로는 제외 + 개발 환경에서 `NODE_ENV === "development"` 시 비활성화 옵션 고려 |
| Google OAuth Supabase 설정 | 환경변수 없이도 Supabase 대시보드 설정 필요 | 엔지니어가 사전에 Supabase 대시보드 설정 완료 후 코드 작업 |
| `pipeline_history` 테이블 존재 여부 | 마이그레이션에 없으면 위젯 API 500 에러 | 마이그레이션 파일 확인 선행 → 없으면 `/api/pipelines/history` 엔드포인트로 대체 |
| 인메모리 Rate Limit 서버 재시작 | 재시작 시 카운터 초기화 | 로컬 도구이므로 허용 (MVP 기준) |

---

## 6. 최종 파일 변경 목록

```
Task 3 (Rate Limiting):
  수정: src/middleware.ts

Task 1 (Google OAuth):
  수정: src/components/auth/login-form.tsx

Task 2 (최근 활동 위젯):
  수정: src/components/dashboard/dashboard-content.tsx
  수정: src/components/dashboard/recent-history.tsx
  확인: supabase/migrations/ (pipeline_history 테이블 존재 여부)
  조건부 수정: src/app/api/history/route.ts
```

**총 수정 파일**: 최소 4개, 최대 5개  
**신규 파일 생성**: 없음 (기존 파일 수정만으로 완결)
