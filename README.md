# Claude Dev System

자연어로 개발 태스크를 입력하면 **PM / Engineer / Reviewer** 세 에이전트가 순서대로 돌면서 분석 → 구현 → 코드 리뷰까지 처리하는 로컬 대시보드.

Claude CLI를 `child_process.spawn`으로 직접 띄워서 에이전트를 실행하기 때문에 **API 과금이 없고**(Claude Max 구독 기반), 에이전트마다 독립 프로세스로 격리됩니다.

Vibe Coding으로 만들었습니다. 아키텍처 설계, 프롬프트 구조, DB 스키마, 테스트 전략까지 Claude와 자연어로 협업하면서 만든 프로젝트입니다.

![Dashboard](docs/screenshots/dashboard.png)

---

## 왜 이렇게 만들었나

### API 안 쓰고 CLI를 spawn하는 이유

Claude Max 구독이 있으면 CLI는 로컬 소켓 인증으로 무제한 사용할 수 있습니다. `api.anthropic.com`을 호출하면 토큰당 과금이 붙지만, CLI spawn은 **$0**입니다.

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

### 테스트를 왜 80개나 짰나

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

### 자연어 → 태스크 분해
입력을 Claude CLI로 파싱해서 복잡도, 에이전트 역할, 수락 기준이 붙은 구조화된 태스크 목록으로 변환합니다. 직접 텍스트 입력 외에 **Notion 기획 문서**를 입력 소스로 선택할 수도 있습니다.

![Wizard](docs/screenshots/wizard-task-input.png)

### 3-에이전트 체인
PM → Engineer → Reviewer 순차 실행. 각 에이전트는 독립 CLI 프로세스로, `--allowedTools`로 도구 접근이 제한됩니다. Reviewer 거부 시 Engineer 재작업 → 재검증 (최대 2사이클).

### 실시간 모니터링
Supabase Realtime 4채널(`pipeline` / `agents` / `logs` / `tasks`)로 에이전트 상태, 로그, 태스크 진행률을 실시간 표시합니다. 로그 뷰어는 `@tanstack/react-virtual`로 2,000건 가상 스크롤 처리됩니다.

### Canvas 에이전트 시각화
ReactFlow 기반 노드 에디터로 에이전트 파이프라인 구조를 시각화합니다. 드래그 앤 드롭으로 노드 배치, 에이전트 간 연결 관리, 역할별 색상(PM 보라 / Engineer 파랑 / Reviewer 초록)으로 상태를 표시합니다.

### 코드 리뷰 UI
unified/split diff 뷰어, 라인별 코멘트, 승인/거부 워크플로우를 제공합니다. Reviewer 에이전트의 검증 결과를 시각화합니다.

### Notion 연동
Notion 기획 문서를 입력 소스로 선택하면 페이지 내용을 기반으로 태스크가 자동 생성됩니다. 검색, 미리보기, 마크다운 변환을 지원합니다.

### 후속 질의
완료/실패 파이프라인에 이어서 질문할 수 있습니다. 이전 세션 컨텍스트(최근 로그 20건 + 코드 변경사항)가 자동으로 주입되며, 파이프라인당 최대 10개 세션 체인을 지원합니다.

### 실행 이력 + 설정
완료된 파이프라인 아카이브, 검색/필터/페이지네이션을 지원합니다. 설정은 5개 탭(프로필, 키, 환경설정, 알림, 연동)으로 구성됩니다.

![History](docs/screenshots/history.png)

---

## 기술 스택

| 영역 | 기술 |
|---|---|
| 프레임워크 | Next.js 16 (App Router, TypeScript strict, Turbopack) |
| AI 실행 | Claude CLI — `child_process.spawn`, 로컬 소켓 인증 |
| DB / 인증 | Supabase (PostgreSQL 17, RLS, Realtime) |
| 상태 관리 | Zustand 4개 스토어 (auth / wizard / pipeline / UI) |
| UI | shadcn/ui + Tailwind CSS v4 + Framer Motion |
| 노드 에디터 | @xyflow/react (ReactFlow v12) |
| 테스트 | Playwright (80 E2E, 4 프로젝트 구성) |
| 로그 렌더링 | @tanstack/react-virtual (2,000건 가상 스크롤) |
| 외부 연동 | Notion API (@notionhq/client) |
| 마크다운 | react-markdown + remark-gfm |

---

## CLI 실행 코드

에이전트가 실제로 돌아가는 부분(`agent-simulator.ts`, 1,500줄):

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

15개 파일, **80개 E2E 테스트**. Playwright 4개 프로젝트로 구성:

| 프로젝트 | 테스트 수 | 범위 |
|---|---|---|
| setup | - | 로그인해서 세션 쿠키 저장 |
| unauthenticated | 18 | 비인증 상태 보호 라우트/API 접근 차단 |
| authenticated | 14 | 대시보드 레이아웃, 네비게이션, API 응답 |
| common | 48 | 파이프라인 실행, 후속 질의, Notion 연동, 디자인 토큰 |

```bash
npm test             # 전체
npm run test:auth    # setup + authenticated
npm run test:unauth  # 인증 가드 + 로그인 페이지
npm run test:common  # 기능 통합 테스트
npm run test:report  # HTML 리포트 열기
```

---

## DB 구조

PostgreSQL 17, **10개 테이블**, 전체 RLS 적용. **9개 마이그레이션**으로 관리.

```
pipelines ─┬─ tasks
            ├─ agents
            └─ sessions ─┬─ agent_logs
                         └─ code_changes ── code_change_comments
```

- `pipelines` — 실행 레코드 (상태, 모드, config JSONB)
- `tasks` — 파싱된 태스크 (복잡도, 수락 기준)
- `agents` — 파이프라인별 에이전트 인스턴스 (역할, 상태, 진행률)
- `sessions` — CLI 실행 세션 (`parent_session_id`로 후속 질의 체인 추적)
- `agent_logs` — 스트리밍 로그 (타임스탬프, 레벨, 내용)
- `code_changes` — diff + 리뷰 판정
- `profiles` / `user_settings` / `preset_templates` — 사용자 메타데이터

---

## 프로젝트 구조

```
src/
├── app/
│   ├── api/                        # 30+ REST 엔드포인트
│   │   ├── pipelines/              #   CRUD, execute, pause, resume, cancel
│   │   │   ├── parse/              #   자연어 → 태스크 분해 (Claude CLI)
│   │   │   └── [id]/              #   실행, 로그, 코드 변경, 세션, 리뷰
│   │   ├── notion/                 #   Notion 페이지 조회/변환
│   │   ├── history/                #   완료된 파이프라인 아카이브
│   │   ├── sessions/               #   세션 메타데이터, 로그, 토큰
│   │   └── settings/               #   사용자 설정 + 프로필
│   └── (dashboard)/                # 보호된 라우트 그룹
│       ├── dashboard/              #   파이프라인 목록 + 캔버스
│       │   └── canvas/             #   에이전트 노드 시각화
│       ├── pipelines/new/          #   3단계 위자드 (분석 → 설정 → 모드)
│       ├── pipelines/[id]/         #   실시간 모니터 + 코드 리뷰
│       ├── history/                #   실행 이력
│       └── settings/               #   설정 (5탭)
├── components/
│   ├── canvas/                     # ReactFlow 노드 에디터
│   ├── wizard/                     # 위자드 (Notion 연동 포함)
│   ├── pipeline/                   # 모니터링 + 로그 뷰어
│   ├── review/                     # diff 뷰어 + 코멘트
│   ├── dashboard/                  # 대시보드 카드/목록
│   ├── layout/                     # 사이드바, 탑바, 네비게이션
│   └── ui/                         # shadcn/ui (27개)
├── lib/
│   ├── simulator/
│   │   └── agent-simulator.ts      # 에이전트 오케스트레이터 (1,500줄)
│   ├── notion/                     # Notion SDK 클라이언트 + 블록→마크다운 변환
│   ├── api/                        # 인증, 응답 포맷, 에러 처리
│   ├── supabase/                   # 클라이언트, 서버, 미들웨어
│   └── realtime/                   # Supabase 채널 구독
├── stores/                         # Zustand 4개 스토어
└── types/                          # 도메인 타입 정의

e2e/                                # Playwright 테스트 (80개, 15파일)
supabase/migrations/                # DB 마이그레이션 (9개)
scripts/                            # 스프린트 프롬프트/로그/비교 스크립트
```

---

## 로컬 실행

```bash
# Node.js 22 활성화
source ~/.nvm/nvm.sh && nvm use 22

# 의존성 설치
npm install

# 환경변수 설정
cp .env.local.example .env.local
# → Supabase URL/Key, Notion Token 입력

# Supabase 로컬 시작
npx supabase start

# 개발 서버
npm run dev    # → localhost:3000
```

### 필요한 것
- **Node.js 22**
- **Claude CLI** (인증 완료, Claude Max 구독)
- **Supabase CLI**
- (선택) **Notion API Token** — Notion 연동 사용 시

### 환경변수

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NOTION_TOKEN=...                    # 선택
NOTION_ROOT_PAGE_ID=...             # 선택
```

---

## 스프린트 이력

| 스프린트 | 내용 |
|---|---|
| Sprint 0 | 프로젝트 기반 구축 — Next.js + Supabase + Auth + DB 스키마 |
| Sprint 1 | E2E 테스트 프레임워크 (Playwright 49 tests) |
| Sprint 2 | 3단계 파이프라인 생성 위자드 + CLI spawn 전환 |
| Sprint 3 | 실시간 모니터링 — Supabase Realtime 4채널 + 로그 뷰어 |
| Sprint 4 | 코드 리뷰 — diff 뷰어 + 라인 코멘트 + 판정 워크플로우 |
| Sprint 5 | 실행 이력 + 설정 + 후속 질의 세션 체인 |
| Sprint 6 | Notion 연동 + Canvas 에이전트 시각화 + 입력 소스 시스템 |

---

## 라이선스

Private project.
