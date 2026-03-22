#!/bin/bash
# =============================================================================
# 비용 분석 리포트 생성기
# .claude/hooks/cost-log.jsonl을 읽어 사용량 요약을 출력
#
# 사용법:
#   ./scripts/cost-report.sh                      # 전체 기간
#   ./scripts/cost-report.sh 2026-02-25           # 특정 날짜
#   ./scripts/cost-report.sh 2026-02-20 2026-02-25  # 날짜 범위
# =============================================================================

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COST_LOG="${PROJECT_ROOT}/.claude/hooks/cost-log.jsonl"

# --- 날짜 필터 인자 처리 ---
START_DATE="${1:-}"
END_DATE="${2:-}"

# --- 로그 파일 존재 확인 ---
if [[ ! -f "$COST_LOG" ]]; then
  echo "❌ 비용 로그 파일이 없습니다: ${COST_LOG}"
  echo "   아직 Hook이 실행된 적이 없거나 경로가 올바르지 않습니다."
  exit 1
fi

TOTAL_LINES=$(wc -l < "$COST_LOG" | tr -d ' ')
if [[ "$TOTAL_LINES" -eq 0 ]]; then
  echo "비용 로그가 비어 있습니다."
  exit 0
fi

# --- jq 사용 가능 여부에 따라 분기 ---
if command -v jq &>/dev/null; then
  # ================================================================
  # jq 사용 가능 — 정확한 집계
  # ================================================================

  # 날짜 필터 적용
  FILTER="."
  if [[ -n "$START_DATE" && -n "$END_DATE" ]]; then
    FILTER="select(.date >= \"${START_DATE}\" and .date <= \"${END_DATE}\")"
  elif [[ -n "$START_DATE" ]]; then
    FILTER="select(.date == \"${START_DATE}\")"
  fi

  FILTERED=$(cat "$COST_LOG" | jq -c "$FILTER" 2>/dev/null)

  if [[ -z "$FILTERED" ]]; then
    echo "지정된 기간에 데이터가 없습니다."
    exit 0
  fi

  echo "============================================================"
  echo "  📊 Claude 에이전트 비용 분석 리포트"
  echo "============================================================"
  if [[ -n "$START_DATE" && -n "$END_DATE" ]]; then
    echo "  기간: ${START_DATE} ~ ${END_DATE}"
  elif [[ -n "$START_DATE" ]]; then
    echo "  기간: ${START_DATE}"
  else
    echo "  기간: 전체"
  fi
  echo "------------------------------------------------------------"
  echo ""

  # --- 전체 요약 ---
  echo "$FILTERED" | jq -s '
    {
      total_entries: length,
      agent_stops: [.[] | select(.type == "agent_stop")] | length,
      tool_uses: [.[] | select(.type == "tool_use")] | length,
      total_input_tokens: ([.[] | select(.type == "agent_stop") | .input_tokens] | add // 0),
      total_output_tokens: ([.[] | select(.type == "agent_stop") | .output_tokens] | add // 0),
      total_cost_micro: ([.[] | select(.type == "agent_stop") | .cost_total_micro] | add // 0)
    }
  ' | jq -r '
    "  [ 전체 요약 ]",
    "  ├─ 총 이벤트 수:    \(.total_entries)건",
    "  ├─ 에이전트 실행:   \(.agent_stops)회",
    "  ├─ 도구 사용:       \(.tool_uses)회",
    "  ├─ 입력 토큰:       \(.total_input_tokens | tostring | gsub("(?<a>[0-9])(?=([0-9]{3})+$)"; .a + ","))개",
    "  ├─ 출력 토큰:       \(.total_output_tokens | tostring | gsub("(?<a>[0-9])(?=([0-9]{3})+$)"; .a + ","))개",
    "  └─ 추정 비용:       $\(.total_cost_micro / 1000000 | . * 10000 | floor / 10000) USD",
    ""
  '

  # --- 에이전트 역할별 분석 ---
  echo "  [ 에이전트별 분석 ]"
  echo "  ┌──────────────┬────────────┬────────────┬──────────────┐"
  echo "  │ 에이전트     │ 입력 토큰  │ 출력 토큰  │ 추정 비용    │"
  echo "  ├──────────────┼────────────┼────────────┼──────────────┤"

  echo "$FILTERED" | jq -s '
    [.[] | select(.type == "agent_stop")]
    | group_by(.agent_role)
    | map({
        role: .[0].agent_role,
        count: length,
        input_tokens: ([.[].input_tokens] | add // 0),
        output_tokens: ([.[].output_tokens] | add // 0),
        cost_micro: ([.[].cost_total_micro] | add // 0)
      })
    | sort_by(-.cost_micro)
    | .[]
  ' | jq -r '
    "  │ \(.role | . + "            " | .[:12]) │ \(.input_tokens | tostring | ("          " + .) | .[-10:]) │ \(.output_tokens | tostring | ("          " + .) | .[-10:]) │ $\(.cost_micro / 1000000 | . * 10000 | floor / 10000 | tostring | . + "        " | .[:12]) │"
  '

  echo "  └──────────────┴────────────┴────────────┴──────────────┘"
  echo ""

  # --- 모델별 분석 ---
  echo "  [ 모델별 분석 ]"
  echo "  ┌──────────────┬────────────┬────────────┬──────────────┐"
  echo "  │ 모델         │ 입력 토큰  │ 출력 토큰  │ 추정 비용    │"
  echo "  ├──────────────┼────────────┼────────────┼──────────────┤"

  echo "$FILTERED" | jq -s '
    [.[] | select(.type == "agent_stop")]
    | group_by(.model)
    | map({
        model: .[0].model,
        count: length,
        input_tokens: ([.[].input_tokens] | add // 0),
        output_tokens: ([.[].output_tokens] | add // 0),
        cost_micro: ([.[].cost_total_micro] | add // 0)
      })
    | sort_by(-.cost_micro)
    | .[]
  ' | jq -r '
    "  │ \(.model | . + "            " | .[:12]) │ \(.input_tokens | tostring | ("          " + .) | .[-10:]) │ \(.output_tokens | tostring | ("          " + .) | .[-10:]) │ $\(.cost_micro / 1000000 | . * 10000 | floor / 10000 | tostring | . + "        " | .[:12]) │"
  '

  echo "  └──────────────┴────────────┴────────────┴──────────────┘"
  echo ""

  # --- 도구 사용 Top 10 ---
  echo "  [ 도구 사용 빈도 Top 10 ]"
  echo "  ┌──────────────────────────┬──────────┐"
  echo "  │ 도구 이름                │ 사용 횟수│"
  echo "  ├──────────────────────────┼──────────┤"

  echo "$FILTERED" | jq -s '
    [.[] | select(.type == "tool_use")]
    | group_by(.tool_name)
    | map({tool: .[0].tool_name, count: length})
    | sort_by(-.count)
    | .[:10]
    | .[]
  ' | jq -r '
    "  │ \(.tool | . + "                          " | .[:24]) │ \(.count | tostring | ("        " + .) | .[-8:]) │"
  '

  echo "  └──────────────────────────┴──────────┘"
  echo ""

  # --- 세션별 요약 (최근 5개) ---
  echo "  [ 최근 세션 요약 (최대 5개) ]"

  echo "$FILTERED" | jq -s '
    [.[] | select(.type == "agent_stop")]
    | group_by(.session_id)
    | map({
        session: .[0].session_id,
        timestamp: .[0].timestamp,
        agents: ([.[].agent_role] | unique | join(", ")),
        total_tokens: ([.[].total_tokens] | add // 0),
        cost_micro: ([.[].cost_total_micro] | add // 0)
      })
    | sort_by(.timestamp) | reverse
    | .[:5]
    | .[]
  ' | jq -r '
    "  - \(.session | .[:20])...  에이전트: \(.agents)  토큰: \(.total_tokens)  비용: $\(.cost_micro / 1000000 | . * 10000 | floor / 10000)"
  ' || true

else
  # ================================================================
  # jq 미설치 — 간략한 요약 (grep/awk 기반)
  # ================================================================
  echo "============================================================"
  echo "  Claude 에이전트 비용 분석 리포트 (간략 모드)"
  echo "  ※ jq 설치 시 상세 분석 가능: brew install jq"
  echo "============================================================"
  echo ""

  # 날짜 필터
  if [[ -n "$START_DATE" && -n "$END_DATE" ]]; then
    DATA=$(grep -E "\"date\":\"(${START_DATE}" "$COST_LOG" 2>/dev/null || cat "$COST_LOG")
    echo "  ※ 날짜 필터는 jq 모드에서만 정확히 동작합니다"
  elif [[ -n "$START_DATE" ]]; then
    DATA=$(grep "\"date\":\"${START_DATE}\"" "$COST_LOG" 2>/dev/null || echo "")
  else
    DATA=$(cat "$COST_LOG")
  fi

  if [[ -z "$DATA" ]]; then
    echo "  데이터가 없습니다."
    exit 0
  fi

  TOTAL_LINES=$(echo "$DATA" | wc -l | tr -d ' ')
  AGENT_STOPS=$(echo "$DATA" | grep -c '"type":"agent_stop"' || echo "0")
  TOOL_USES=$(echo "$DATA" | grep -c '"type":"tool_use"' || echo "0")

  echo "  [ 전체 요약 ]"
  echo "  ├─ 총 이벤트 수:  ${TOTAL_LINES}건"
  echo "  ├─ 에이전트 실행: ${AGENT_STOPS}회"
  echo "  └─ 도구 사용:     ${TOOL_USES}회"
  echo ""
  echo "  ※ 상세 토큰/비용 분석은 jq 설치 후 다시 실행하세요."
fi

echo ""
echo "============================================================"
echo "  리포트 생성 시간: $(date '+%Y-%m-%d %H:%M:%S')"
echo "  로그 파일: ${COST_LOG}"
echo "============================================================"
