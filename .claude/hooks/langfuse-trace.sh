#!/bin/bash
# =============================================================================
# Langfuse 트레이싱 훅 스크립트
# Claude Code Hook 이벤트를 Langfuse로 전송하여 에이전트 관찰성 확보
#
# 지원 이벤트: PostToolUse, Stop
# 환경 변수: LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_HOST
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# --- Langfuse 설정 ---
LANGFUSE_HOST="${LANGFUSE_HOST:-https://cloud.langfuse.com}"
LANGFUSE_PUBLIC_KEY="${LANGFUSE_PUBLIC_KEY:-}"
LANGFUSE_SECRET_KEY="${LANGFUSE_SECRET_KEY:-}"

# 키가 없으면 조용히 종료 (에러 없음)
if [[ -z "$LANGFUSE_PUBLIC_KEY" ]]; then
  exit 0
fi

if [[ -z "$LANGFUSE_SECRET_KEY" ]]; then
  log_warn "LANGFUSE_SECRET_KEY가 설정되지 않음 — 트레이싱 건너뜀"
  exit 0
fi

# --- stdin에서 이벤트 읽기 ---
EVENT_JSON=$(read_event_json)
if [[ -z "$EVENT_JSON" ]]; then
  exit 0
fi

# --- 이벤트 파싱 ---
# Claude Code 훅은 카테고리별로 호출되므로 JSON 내용으로 이벤트 타입을 추론
EVENT_TYPE=$(json_get "$EVENT_JSON" "hook_event_name")
if [[ -z "$EVENT_TYPE" ]]; then
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
TOOL_NAME=$(json_get_nested "$EVENT_JSON" "tool_name")
AGENT_ROLE=$(json_get "$EVENT_JSON" "agent_role")
MODEL=$(json_get "$EVENT_JSON" "model")
TIMESTAMP=$(now_iso)
TRACE_ID=$(generate_trace_id)

# 세션 ID 폴백
if [[ -z "$SESSION_ID" ]]; then
  SESSION_ID="unknown-session"
fi

# 에이전트 역할 폴백
if [[ -z "$AGENT_ROLE" ]]; then
  AGENT_ROLE="unknown"
fi

# --- Langfuse API 호출 함수 ---
send_to_langfuse() {
  local payload="$1"

  # 백그라운드로 전송 (fire-and-forget, 에이전트 실행 차단 방지)
  curl -s -X POST \
    "${LANGFUSE_HOST}/api/public/ingestion" \
    -H "Content-Type: application/json" \
    -H "Authorization: Basic $(echo -n "${LANGFUSE_PUBLIC_KEY}:${LANGFUSE_SECRET_KEY}" | base64)" \
    -d "$payload" \
    --connect-timeout 3 \
    --max-time 5 \
    -o /dev/null \
    2>/dev/null &
}

# --- 이벤트 타입별 처리 ---
case "$EVENT_TYPE" in
  "PostToolUse")
    # 도구 사용 이벤트 → Langfuse span으로 기록
    TOOL_INPUT=$(json_get "$EVENT_JSON" "tool_input")
    TOOL_RESULT=$(json_get "$EVENT_JSON" "tool_result")
    DURATION_MS=$(json_get_number "$EVENT_JSON" "duration_ms")

    PAYLOAD=$(cat <<EOF
{
  "batch": [{
    "id": "${TRACE_ID}",
    "type": "span-create",
    "timestamp": "${TIMESTAMP}",
    "body": {
      "traceId": "${SESSION_ID}",
      "name": "tool:${TOOL_NAME}",
      "startTime": "${TIMESTAMP}",
      "metadata": {
        "agent_role": "${AGENT_ROLE}",
        "model": "${MODEL}",
        "tool_name": "${TOOL_NAME}",
        "duration_ms": ${DURATION_MS:-0},
        "source": "claude-code-hook"
      },
      "input": $(echo "${TOOL_INPUT:-null}" | head -c 1000),
      "output": $(echo "${TOOL_RESULT:-null}" | head -c 1000)
    }
  }]
}
EOF
)
    send_to_langfuse "$PAYLOAD"
    log_info "Langfuse span 전송: tool=${TOOL_NAME} agent=${AGENT_ROLE} session=${SESSION_ID}"
    ;;

  "Stop")
    # 에이전트 실행 종료 이벤트 → Langfuse trace로 기록
    TOTAL_TOKENS=$(json_get_number "$EVENT_JSON" "total_tokens")
    INPUT_TOKENS=$(json_get_number "$EVENT_JSON" "input_tokens")
    OUTPUT_TOKENS=$(json_get_number "$EVENT_JSON" "output_tokens")
    STOP_REASON=$(json_get "$EVENT_JSON" "stop_reason")
    DURATION_MS=$(json_get_number "$EVENT_JSON" "duration_ms")

    PAYLOAD=$(cat <<EOF
{
  "batch": [{
    "id": "${TRACE_ID}",
    "type": "trace-create",
    "timestamp": "${TIMESTAMP}",
    "body": {
      "id": "${SESSION_ID}",
      "name": "agent:${AGENT_ROLE}",
      "metadata": {
        "agent_role": "${AGENT_ROLE}",
        "model": "${MODEL}",
        "stop_reason": "${STOP_REASON}",
        "duration_ms": ${DURATION_MS:-0},
        "source": "claude-code-hook"
      },
      "input": {"session_id": "${SESSION_ID}", "agent_role": "${AGENT_ROLE}"},
      "output": {"stop_reason": "${STOP_REASON}", "total_tokens": ${TOTAL_TOKENS:-0}},
      "usage": {
        "input": ${INPUT_TOKENS:-0},
        "output": ${OUTPUT_TOKENS:-0},
        "total": ${TOTAL_TOKENS:-0}
      }
    }
  }]
}
EOF
)
    send_to_langfuse "$PAYLOAD"
    log_info "Langfuse trace 전송: agent=${AGENT_ROLE} tokens=${TOTAL_TOKENS:-0} reason=${STOP_REASON}"
    ;;

  *)
    # 미지원 이벤트 타입 — 무시
    ;;
esac

# 백그라운드 curl 완료 대기하지 않고 즉시 종료
exit 0
