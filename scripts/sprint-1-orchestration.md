# Sprint 1 — 대시보드 홈 + 온보딩 오케스트레이션 플랜

## 팀 구성

### PM (Team Lead) — 실행 PM
- 전체 작업 오케스트레이션 및 컨텍스트 관리
- 태스크 생성, 의존성 설정, 할당
- 결과물 품질 검증 및 통합

### Frontend Developer — 프론트엔드 개발자
- React/Next.js 컴포넌트 구현
- 디자인 시스템 적용, 반응형 UI
- shadcn/ui 기반 컴포넌트 조합

### Senior Developer — 시니어 풀스택 개발자
- API 엔드포인트 구현 (Next.js Route Handlers)
- Supabase 연동 (Realtime, RLS)
- 데이터 모델링, 타입 안전성

### UX Designer — 뇌과학 기반 UX 디자이너
- 인지과학 원칙에 따른 UI 검증
- 접근성(WCAG AA) 검토
- 애니메이션/전환 효과 구현 지시

## 작업 흐름 (3 Phase)

### Phase 1: 병렬 기반 작업 (FE-1.1 + BE-1.1 + BE-1.2 + BE-1.3)
- Frontend: EmptyState 컴포넌트
- Senior: Pipeline API + Template API + Realtime Hook

### Phase 2: 순차 작업 (FE-1.2 → FE-1.3)
- Frontend: PipelineCard → RecentHistory
- Senior: API 연결 및 통합

### Phase 3: 통합 + QA
- UX Designer: 전체 UI 검증
- PM: E2E 테스트 시나리오 검증
