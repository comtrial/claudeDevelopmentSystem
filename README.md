# Claude Dev System

자연어로 개발 태스크를 입력하면 PM / Engineer / Reviewer 세 에이전트가 순서대로 돌면서 분석 → 구현 → 코드 리뷰까지 처리하는 로컬 대시보드.

Claude CLI를 `child_process.spawn`으로 직접 띄워서 에이전트를 실행하기 때문에 API 과금이 없고(Claude Max 구독 기반), 에이전트마다 독립 프로세스로 격리됩니다.

Vibe Coding으로 만들었습니다. 아키텍처 설계, 프롬프트 구조, DB 스키마, 테스트 전략까지 Claude와 자연어로 협업하면서 만든 프로젝트입니다.

---

## 왜 이렇게 만들었나

### API 안 쓰고 CLI를 spawn하는 이유

Claude Max 구독이 있으면 CLI는 로컬 소켓 인증으로 무제한 사용할 수 있습니다. `api.anthropic.com`을 호출하면 토큰당 과금이 붙지만, CLI spawn은 $0입니다.

그리고 CLI를 쓰면 `--allowedTools` 플래그로 에이전트별로 쓸 수 있는 도구(Bash, Read, Write 등)를 제한할 수 있습니다. HTTP API에서는 불가능한 보안 경계입니다.

한 가지 까다로웠던 건 nested invocation인데 — 오케스트레이터 자체가 Claude 프로세스일 때, 자식 Claude 프로세스를 spawn하면 소켓이 충돌합니다. `CLAUDE_CODE_*` 환경변수를 클리닝해서 해결했습니다.

### 에이전트를 왜 3개로 나눴나

하나의 LLM에 "분석하고 구현하고 리뷰해"라고 시키면 앞부분 분석이 대충 끝나고 바로 코드를 짜기 시작합니다. 역할을 물리적으로 분리해서 각 에이전트가 자기 역할에만 집중하게 만들었습니다.

- **PM**: 프로젝트 구조 파악, 의존성 분석, 실행 순서 결정. 코드를 건드리지 않음
- **Engineer**: PM이 만든 분석 artifact를 받아서 실제 구현
- **Reviewer**: Engineer 결과물에 대해 TypeCheck/Build/Lint 검증 후 코드 리뷰

Reviewer가 거부하면 Engineer에게 피드백이 돌아가고, 최대 2번 재작업합니다. 이 루프가 있으면 초안의 품질이 낮아도 결과물은 수렴합니다.

### Context Engineering

프롬프트 한 줄 바꾸는 게 아니라, 에이전트가 받는 전체 컨텍스트 구조를 설계했습니다.

- System prompt(`--append-system-prompt`)에는 역할 정체성 + 고정 규칙 + CLAUDE.md(프로젝트 규칙 문서)를 주입
- User prompt(`-p`)에는 `<instructions>`, `<tasks>`, `<previous-results>`, `<context>` XML 태그로 구조화된 정보를 넣음
- 이전 에이전트 출력물은 60K자 이내로 잘라서(앞 70% + 뒤 30%) 다음 에이전트에 전달
- 각 역할마다 방법론이 다름 — PM은 Step 0(프로젝트 탐색)부터 시작, Engineer는 dry run 후 점진 구현, Reviewer는 반드시 파일을 읽은 뒤 판정

### 테스트를 왜 81개나 짰나

Vibe Coding이라 AI가 짠 코드가 의도대로 동작하는지 사람이 매번 확인하기 어렵습니다. 그래서 Playwright E2E를 기능 구현과 동시에 만들었고, 회귀를 잡는 안전망으로 씁니다.

인증 경계(보호 라우트 + API 엔드포인트 비인증 차단), 파이프라인 전체 실행 흐름(300초 타임아웃), 후속 질의 세션 체인, Notion 연동(API 모킹) 등을 커버합니다.

---

## 동작 흐름

```
"로그인 기능 구현해줘" (자연어 입력)
        │
        ▼
   NLP 태스크 분해 (Claude CLI, JSON 출력)
        │  Task 1: DB 스키마 설계
        │  Task 2: API 엔드포인트 구현
        │  Task 3: 프론트엔드 폼 구현
        │  + 복잡도/수락기준/에이전트 역할 자동 배정
        │
        ▼
   PM Agent ──▶ Engineer Agent ──▶ Reviewer Agent
   (분석/계획)    (코드 구현)        (검증/판정)
                      ▲                  │
                      │  CHANGES_        │
                      │  REQUESTED       │
                      └──────────────────┘
                      (최대 2회 재작업)

   검증 게이트: tsc --noEmit → npm run build → eslint
        │
        ▼
   대시보드에서 실시간 모니터링
   (에이전트 상태 / 로그 스트리밍 / 태스크 진행률 / 코드 리뷰)
```

---

## 주요 기능

- **자연어 → 태스크 분해**: 입력을 Claude CLI로 파싱해서 복잡도, 에이전트 역할, 수락 기준이 붙은 구조화된 태스크 목록으로 변환
- **3-에이전트 체인**: PM → Engineer → Reviewer 순차 실행. 각 에이전트는 독립 CLI 프로세스
- **자동 피드백 루프**: Reviewer 거부 시 Engineer 재작업 → 재검증 (최대 2사이클)
- **검증 게이트**: Reviewer 전에 TypeCheck / Build / Lint를 자동으로 돌림
- **실시간 대시보드**: Supabase Realtime 4채널로 에이전트 상태, 로그, 태스크 진행률 실시간 표시
- **코드 리뷰 UI**: unified/split diff 뷰어, 라인별 코멘트, 승인/거부 워크플로우
- **후속 질의**: 완료/실패 파이프라인에 이어서 질문 가능. 이전 세션 컨텍스트가 자동 주입됨
- **Notion 연동**: Notion 기획 문서를 입력 소스로 선택하면 내용을 기반으로 태스크 자동 생성
- **실행 모드**: `auto_edit`(전체 자동) / `review`(구현+검증) / `plan_only`(분석만)

---

## 기술 스택

| 영역 | 기술 |
|---|---|
| 프레임워크 | Next.js 16 (App Router, TypeScript strict) |
| AI 실행 | Claude CLI — `child_process.spawn`, 로컬 소켓 인증 |
| DB / 인증 | Supabase (PostgreSQL 17, RLS, Realtime) |
| 상태 관리 | Zustand (auth / wizard / pipeline / UI) |
| UI | shadcn/ui + Tailwind CSS v4 |
| 테스트 | Playwright (81 E2E, 4 프로젝트 구성) |
| 로그 렌더링 | @tanstack/react-virtual (2,000건 가상 스크롤) |
| 외부 연동 | Notion API (@notionhq/client) |

---

## CLI 실행 코드

에이전트가 실제로 돌아가는 부분(`agent-simulator.ts`):

```typescript
const proc = spawn("claude", [
  "-p", prompt,                          // 태스크별 프롬프트
  "--append-system-prompt", systemPrompt, // 역할 + 프로젝트 컨텍스트
  "--allowedTools", ...tools,             // 에이전트별 도구 제한
  "--max-turns", "25",
  "--output-format", "text"
], {
  cwd: workingDir,
  env: cleanedEnv,   // CLAUDE_CODE_* 환경변수 제거 (nested invocation 대응)
  stdio: ["ignore", "pipe", "pipe"]
});
```

`cleanedEnv`는 부모 Claude 프로세스의 세션 변수를 제거해서 자식 프로세스가 새 소켓으로 연결되도록 합니다. 이걸 안 하면 소켓 충돌로 spawn이 실패합니다.

---

## 실시간 모니터링

파이프라인 실행 중 Supabase Realtime 4개 채널을 구독합니다:

- `pipeline:{id}` — 파이프라인 상태 변경 → 상태 뱃지, 프로그레스 바
- `agents:{id}` — 에이전트 진행 → 에이전트 카드 상태/진행률
- `logs:{id}` — 로그 INSERT → 로그 뷰어 실시간 스트리밍 (2,000건 버퍼, FIFO)
- `tasks:{id}` — 태스크 완료 → 타임라인 업데이트

로그 뷰어는 `@tanstack/react-virtual`로 가상 스크롤 처리해서 2,000건이 쌓여도 DOM이 무겁지 않습니다.

---

## 테스트

15개 파일, 81개 E2E 테스트. Playwright 4개 프로젝트로 구성:

- **setup**: 로그인해서 세션 쿠키를 `e2e/.auth/user.json`에 저장
- **unauthenticated** (18 tests): 비인증 상태에서 보호 라우트/API 접근 차단 확인
- **authenticated** (11 tests): 로그인 후 대시보드 레이아웃, 네비게이션, API 응답
- **common** (52 tests): 파이프라인 전체 실행, 후속 질의 체인, Notion 연동, 디자인 토큰 등

```bash
npm test             # 전체
npm run test:auth    # setup + authenticated
npm run test:unauth  # 인증 가드 + 로그인 페이지
npm run test:common  # 기능 통합 테스트
npm run test:report  # HTML 리포트 열기
```

---

## DB 구조

PostgreSQL 17, 10개 테이블, 전체 RLS 적용. 9개 마이그레이션으로 관리.

핵심 테이블: `pipelines` → `tasks` / `agents` / `sessions` → `agent_logs` / `code_changes`

세션은 체인 구조를 지원합니다 — `parent_session_id`와 `session_number`로 후속 질의 이력을 추적합니다.

---

## 프로젝트 구조

```
src/
├── app/
│   ├── api/                     # 30+ REST 엔드포인트
│   │   ├── pipelines/           #   CRUD, execute, pause, resume, cancel
│   │   │   ├── parse/           #   자연어 → 태스크 분해 (Claude CLI)
│   │   │   └── [id]/            #   실행, 로그, 코드 변경, 세션
│   │   ├── history/             #   완료된 파이프라인 아카이브
│   │   ├── settings/            #   사용자 설정
│   │   └── notion/              #   Notion 페이지 조회
│   └── (dashboard)/             # 보호된 라우트 그룹
│       ├── dashboard/           #   파이프라인 목록
│       ├── pipelines/new/       #   3단계 위자드 (분석 → 설정 → 모드)
│       ├── pipelines/[id]/      #   실시간 모니터 + 로그 뷰어
│       ├── history/             #   실행 이력
│       └── settings/            #   설정
├── lib/
│   ├── simulator/
│   │   └── agent-simulator.ts   # 에이전트 오케스트레이터 (1,500줄)
│   ├── api/                     # 인증, 응답 포맷, 에러 처리
│   ├── supabase/                # 클라이언트, 서버, 미들웨어
│   └── realtime/                # Supabase 채널 구독
├── stores/                      # Zustand 4개 스토어
├── components/                  # UI 컴포넌트
└── types/                       # 도메인 타입 정의

e2e/                             # Playwright 테스트 (81개)
supabase/migrations/             # DB 마이그레이션 (9개)
```

---

## 로컬 실행

```bash
source ~/.nvm/nvm.sh && nvm use 22
npm install
cp .env.local.example .env.local   # Supabase URL/Key 설정
npx supabase start
npm run dev                        # localhost:3000
```

필요한 것: Node.js 22, Claude CLI (인증 완료), Supabase CLI
