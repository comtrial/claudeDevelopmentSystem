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
  1. `src/components/dashboard/recent-history.tsx` — 상태 배지 추가, API 엔드포인트 변경(`/api/pipelines?limit=5&sort=updated_at`)
- **구현 단계**:
  1. `/api/pipelines?limit=5` 호출로 변경 (전체 상태 포함, updated_at 기준 최신 5개)
  2. `shadcn Badge` 컴포넌트로 상태 표시 — `running`(파랑), `completed`(초록), `failed`(빨강), `paused`(노랑), `draft`(회색)
  3. 기존 `CheckCircle2/XCircle` 아이콘 제거 후 Badge로 대체
  4. 타이틀을 "최근 활동"으로 변경
- **검증 방법**: 대시보드에서 실행 중/완료/실패 파이프라인이 배지와 함께 최대 5개 표시 확인.
- **의존성**: 없음 (`/api/pipelines` 엔드포인트 기존 존재 확인됨)
- **위험도**: Low — 기존 컴포넌트 수정, UI 전용 변경

> **주의**: `PipelineHistory` 타입 대신 `PipelineSummary` 타입으로 교체 필요. `src/types/pipeline-summary.ts` 확인 후 맞춤.

---

## Task 3: API Rate Limiting 미들웨어 구현
- **목표**: 모든 `/api/*` 라우트에 IP 기반 분당 60회 제한 적용. 초과 시 429 + `Retry-After` 헤더 반환.
- **수정 파일**:
  1. `src/lib/rate-limit.ts` — 신규 생성: 인메모리 Map 기반 rate limiter 로직
  2. `src/middleware.ts` — rate limit 체크 로직 삽입
- **구현 단계**:
  1. `src/lib/rate-limit.ts` 생성: `Map<ip, {count, resetAt}>` 슬라이딩 윈도우 (60초), `checkRateLimit(ip): { limited: boolean, retryAfter: number }` export
  2. `src/middleware.ts`: `/api/` 경로에만 rate limit 체크 추가
  3. 초과 시 `new NextResponse(null, { status: 429, headers: { 'Retry-After': String(retryAfter) } })` 반환
  4. IP 추출: `request.headers.get('x-forwarded-for') ?? request.ip ?? '127.0.0.1'`
- **검증 방법**: `for` loop로 61회 연속 API 호출 시 61번째에서 429 + `Retry-After` 헤더 반환 확인.
- **의존성**: 없음
- **위험도**: Medium — Edge Runtime에서 모듈 수준 `Map`은 워커 재시작 시 초기화됨. **로컬 전용 앱이므로 허용**. 단, Next.js Edge Runtime에서 `globalThis` 기반 Map 공유 필요 (`const store = (globalThis as any).__rateLimitStore ??= new Map()`).

---

## Step 5: Execution Order (권장)

```
1단계 (병렬): Task 1 + Task 3
  - 완전히 독립적, 파일 충돌 없음

2단계: Task 2
  - 독립적이나 1단계 완료 후 검토 권장 (대시보드 동작 확인 후 위젯 개선)
```

---

## Self-Check

- [x] 실제 파일 읽은 후 경로 특정 (`login-form.tsx`, `recent-history.tsx`, `middleware.ts`, `use-auth.ts`, `auth/callback/route.ts` 직접 확인)
- [x] 각 스펙 20라인 이하
- [x] Task 2: "전체 상태 포함" 결정은 요청의 "상태 뱃지" + 기존 컴포넌트 분석 기반 (발명 아님)
- [x] `RecentHistory` 기존 존재 사실 명시하여 중복 작업 방지
- [x] Task 3 Edge Runtime 제약 명시
