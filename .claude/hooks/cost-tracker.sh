#!/bin/bash
# =============================================================================
# 로컬 비용 추적기
# 에이전트별, 세션별, 모델별 토큰 사용량과 비용 추정치를 JSONL로 기록
#
# 비용 추정 기준 (per 1M tokens):
#   - opus:   input $15,  output $75
#   - sonnet: input $3,   output $15
#   - haiku:  input $0.25, output $1.25
#
# 출력 파일: .claude/hooks/cost-log.jsonl
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# --- 비용 로그 파일 경로 ---
COST_LOG="${SCRIPT_DIR}/cost-log.jsonl"

# --- stdin에서 이벤트 읽기 ---
EVENT_JSON=$(read_event_json)
if [[ -z "$EVENT_JSON" ]]; then
  exit 0
fi

# --- 이벤트 파싱 ---
# Claude Code 훅은 카테고리별로 호출되므로 JSON 내용으로 이벤트 타입을 추론
# hook_event_name 필드가 있으면 사용, 없으면 컨텍스트 기반 감지
EVENT_TYPE=$(json_get "$EVENT_JSON" "hook_event_name")
if [[ -z "$EVENT_TYPE" ]]; then
  # stop_reason 존재 → Stop 이벤트, tool_name 존재 → PostToolUse 이벤트
  STOP_CHECK=$(json_get "$EVENT_JSON" "stop_reason")
  TOOL_CHECK=$(json_get "$EVENT_JSON" "tool_name")
  if [[ -n "$STOP_CHECK" ]]; then
    EVENT_TYPE="Stop"
  elif [[ -n "$TOOL_CHECK" ]]; then
    EVENT_TYPE="PostToolUse"
  else
    EVENT_TYPE="unknown"
  fi
fi
SESSION_ID=$(json_get "$EVENT_JSON" "session_id")
AGENT_ROLE=$(json_get "$EVENT_JSON" "agent_role")
MODEL=$(json_get "$EVENT_JSON" "model")
TOOL_NAME=$(json_get_nested "$EVENT_JSON" "tool_name")
TIMESTAMP=$(now_iso)
DATE=$(today_date)

# 폴백 값 설정
SESSION_ID="${SESSION_ID:-unknown}"
AGENT_ROLE="${AGENT_ROLE:-unknown}"
MODEL="${MODEL:-sonnet}"

# --- 모델별 비용 계산 함수 (USD, per 1M tokens) ---
calculate_cost() {
  local model="$1"
  local input_tokens="$2"
  local output_tokens="$3"

  # 모델 이름에서 핵심 부분 추출 (claude-3-opus → opus)
  local model_key=""
  case "$model" in
    *opus*)   model_key="opus" ;;
    *sonnet*) model_key="sonnet" ;;
    *haiku*)  model_key="haiku" ;;
    *)        model_key="sonnet" ;;  # 기본값: sonnet 비용 적용
  esac

  # 비용 계산 (정수 연산으로 소수점 처리 — bc 없이도 동작)
  local input_cost_micro=0
  local output_cost_micro=0

  case "$model_key" in
    "opus")
      # input: $15/1M = $0.000015/token = 15 micro-dollars/1K tokens
      input_cost_micro=$(( input_tokens * 15 ))
      # output: $75/1M = $0.000075/token = 75 micro-dollars/1K tokens
      output_cost_micro=$(( output_tokens * 75 ))
      ;;
    "sonnet")
      input_cost_micro=$(( input_tokens * 3 ))
      output_cost_micro=$(( output_tokens * 15 ))
      ;;
    "haiku")
      # input: $0.25/1M, output: $1.25/1M — 매우 저렴
      # 정수 연산에서 0이 될 수 있으므로 최소 단위 보정
      input_cost_micro=$(( input_tokens * 1 ))
      output_cost_micro=$(( output_tokens * 2 ))
      ;;
  esac

  # micro-dollars를 달러로 변환 (1M으로 나눔)
  # 결과: "input_micro output_micro total_micro"
  local total_micro=$(( input_cost_micro + output_cost_micro ))
  echo "${input_cost_micro} ${output_cost_micro} ${total_micro}"
}

# --- 이벤트 타입별 처리 ---
case "$EVENT_TYPE" in
  "PostToolUse")
    # 도구 사용 기록 — 토큰 비용은 없지만 도구 사용 패턴 추적
    DURATION_MS=$(json_get_number "$EVENT_JSON" "duration_ms")

    LOG_ENTRY=$(cat <<EOF
{"timestamp":"${TIMESTAMP}","date":"${DATE}","type":"tool_use","session_id":"${SESSION_ID}","agent_role":"${AGENT_ROLE}","model":"${MODEL}","tool_name":"${TOOL_NAME}","duration_ms":${DURATION_MS:-0},"input_tokens":0,"output_tokens":0,"cost_usd_micro":0}
EOF
)
    echo "$LOG_ENTRY" >> "$COST_LOG"
    ;;

  "Stop")
    # 에이전트 종료 — 토큰 사용량과 비용 추정 기록
    INPUT_TOKENS=$(json_get_number "$EVENT_JSON" "input_tokens")
    OUTPUT_TOKENS=$(json_get_number "$EVENT_JSON" "output_tokens")
    TOTAL_TOKENS=$(json_get_number "$EVENT_JSON" "total_tokens")
    STOP_REASON=$(json_get "$EVENT_JSON" "stop_reason")
    DURATION_MS=$(json_get_number "$EVENT_JSON" "duration_ms")

    INPUT_TOKENS="${INPUT_TOKENS:-0}"
    OUTPUT_TOKENS="${OUTPUT_TOKENS:-0}"
    TOTAL_TOKENS="${TOTAL_TOKENS:-0}"

    # 비용 계산
    COST_PARTS=$(calculate_cost "$MODEL" "$INPUT_TOKENS" "$OUTPUT_TOKENS")
    INPUT_COST_MICRO=$(echo "$COST_PARTS" | cut -d' ' -f1)
    OUTPUT_COST_MICRO=$(echo "$COST_PARTS" | cut -d' ' -f2)
    TOTAL_COST_MICRO=$(echo "$COST_PARTS" | cut -d' ' -f3)

    LOG_ENTRY=$(cat <<EOF
{"timestamp":"${TIMESTAMP}","date":"${DATE}","type":"agent_stop","session_id":"${SESSION_ID}","agent_role":"${AGENT_ROLE}","model":"${MODEL}","stop_reason":"${STOP_REASON:-unknown}","input_tokens":${INPUT_TOKENS},"output_tokens":${OUTPUT_TOKENS},"total_tokens":${TOTAL_TOKENS},"cost_input_micro":${INPUT_COST_MICRO},"cost_output_micro":${OUTPUT_COST_MICRO},"cost_total_micro":${TOTAL_COST_MICRO},"duration_ms":${DURATION_MS:-0}}
EOF
)
    echo "$LOG_ENTRY" >> "$COST_LOG"
    log_info "비용 기록: agent=${AGENT_ROLE} model=${MODEL} tokens=${TOTAL_TOKENS} cost_micro=${TOTAL_COST_MICRO}"
    ;;

  *)
    # 미지원 이벤트 — 무시
    ;;
esac

exit 0
