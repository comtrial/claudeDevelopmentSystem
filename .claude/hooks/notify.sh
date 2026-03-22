#!/bin/bash
# =============================================================================
# ntfy.sh Push Notification Hook
# Sends push notifications for Claude Code agent events
# =============================================================================

set -euo pipefail

# --- Configuration ---
NTFY_TOPIC="${NTFY_TOPIC:-claude-dev-system}"
NTFY_SERVER="${NTFY_SERVER:-https://ntfy.sh}"
NTFY_PRIORITY="${NTFY_PRIORITY:-default}"
TIMEOUT_SECONDS=5

# --- Read stdin (event JSON) ---
INPUT=""
if [ ! -t 0 ]; then
  INPUT=$(cat 2>/dev/null || true)
fi

if [ -z "$INPUT" ]; then
  exit 0
fi

# --- Parse event data ---
# Extract fields using lightweight parsing (no jq dependency required)
# Try jq first, fall back to grep/sed
if command -v jq &>/dev/null; then
  EVENT_TYPE=$(echo "$INPUT" | jq -r '.hook_event_name // .type // "unknown"' 2>/dev/null || echo "unknown")
  TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null || echo "")
  TOOL_INPUT=$(echo "$INPUT" | jq -r '.tool_input // empty' 2>/dev/null || echo "")
  SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty' 2>/dev/null || echo "")
  STOP_REASON=$(echo "$INPUT" | jq -r '.stop_reason // .reason // empty' 2>/dev/null || echo "")
  MESSAGE_CONTENT=$(echo "$INPUT" | jq -r '.message // .content // empty' 2>/dev/null || echo "")
else
  # Fallback: basic extraction with grep/sed
  EVENT_TYPE=$(echo "$INPUT" | grep -o '"hook_event_name"\s*:\s*"[^"]*"' | sed 's/.*: *"//;s/"//' || echo "unknown")
  TOOL_NAME=$(echo "$INPUT" | grep -o '"tool_name"\s*:\s*"[^"]*"' | sed 's/.*: *"//;s/"//' || echo "")
  SESSION_ID=$(echo "$INPUT" | grep -o '"session_id"\s*:\s*"[^"]*"' | sed 's/.*: *"//;s/"//' || echo "")
  STOP_REASON=$(echo "$INPUT" | grep -o '"stop_reason"\s*:\s*"[^"]*"' | sed 's/.*: *"//;s/"//' || echo "")
  MESSAGE_CONTENT=$(echo "$INPUT" | grep -o '"message"\s*:\s*"[^"]*"' | sed 's/.*: *"//;s/"//' || echo "")
fi

# --- Format notification message (Korean) ---
TITLE=""
BODY=""
TAGS=""
PRIORITY="$NTFY_PRIORITY"

case "$EVENT_TYPE" in
  Stop|stop)
    TITLE="[Agent 완료] 작업 종료"
    if [ -n "$STOP_REASON" ]; then
      case "$STOP_REASON" in
        end_turn|complete*)
          BODY="에이전트가 작업을 성공적으로 완료했습니다."
          TAGS="white_check_mark"
          PRIORITY="default"
          ;;
        error*|fail*)
          BODY="에이전트 실행 중 오류가 발생했습니다: ${STOP_REASON}"
          TAGS="x"
          PRIORITY="high"
          ;;
        max_turns*)
          BODY="에이전트가 최대 턴 수에 도달하여 중단되었습니다."
          TAGS="warning"
          PRIORITY="high"
          ;;
        *)
          BODY="에이전트 중단 사유: ${STOP_REASON}"
          TAGS="octagonal_sign"
          ;;
      esac
    else
      BODY="에이전트 실행이 종료되었습니다."
      TAGS="white_check_mark"
    fi
    ;;

  Notification|notification)
    TITLE="[Agent 알림]"
    if [ -n "$MESSAGE_CONTENT" ]; then
      # Truncate long messages
      if [ ${#MESSAGE_CONTENT} -gt 200 ]; then
        BODY="${MESSAGE_CONTENT:0:200}..."
      else
        BODY="$MESSAGE_CONTENT"
      fi
    else
      BODY="에이전트로부터 알림이 도착했습니다."
    fi
    TAGS="bell"
    ;;

  PostToolUse|post_tool_use)
    # Only notify for significant tool completions
    case "$TOOL_NAME" in
      Bash)
        # Check for pipeline-related commands
        if echo "$TOOL_INPUT" | grep -qi "pipeline\|build\|deploy\|test"; then
          TITLE="[파이프라인] 명령 실행 완료"
          BODY="도구: ${TOOL_NAME}"
          TAGS="hammer_and_wrench"
        else
          # Skip routine bash commands
          exit 0
        fi
        ;;
      Write|Edit)
        # Skip individual file operations (too noisy)
        exit 0
        ;;
      *)
        # Skip other tool notifications
        exit 0
        ;;
    esac
    ;;

  *)
    TITLE="[Agent 이벤트] ${EVENT_TYPE}"
    BODY="이벤트가 발생했습니다."
    TAGS="information_source"
    ;;
esac

# --- Append session info if available ---
if [ -n "$SESSION_ID" ]; then
  BODY="${BODY} (세션: ${SESSION_ID:0:8}...)"
fi

# --- Send notification (fire-and-forget) ---
(
  curl -s \
    -H "Title: ${TITLE}" \
    -H "Priority: ${PRIORITY}" \
    -H "Tags: ${TAGS}" \
    --max-time "$TIMEOUT_SECONDS" \
    -d "${BODY}" \
    "${NTFY_SERVER}/${NTFY_TOPIC}" \
    >/dev/null 2>&1
) &

exit 0
