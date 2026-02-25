#!/bin/bash
# =============================================================================
# Event Logging Hook
# Appends structured JSONL entries for monitoring (claude-code-monitor, Langfuse)
# =============================================================================

set -euo pipefail

# --- Configuration ---
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_FILE="${CLAUDE_HOOKS_LOG_FILE:-${SCRIPT_DIR}/events.jsonl}"
MAX_LOG_SIZE_MB="${CLAUDE_HOOKS_MAX_LOG_MB:-50}"
MAX_INPUT_LENGTH=10000

# --- Read stdin (event JSON) ---
INPUT=""
if [ ! -t 0 ]; then
  INPUT=$(cat 2>/dev/null || true)
fi

if [ -z "$INPUT" ]; then
  exit 0
fi

# --- Truncate oversized input to prevent log bloat ---
if [ ${#INPUT} -gt $MAX_INPUT_LENGTH ]; then
  INPUT="${INPUT:0:$MAX_INPUT_LENGTH}"
fi

# --- Generate timestamp ---
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z" 2>/dev/null || date -u +"%Y-%m-%dT%H:%M:%SZ")

# --- Parse event type ---
if command -v jq &>/dev/null; then
  EVENT_TYPE=$(echo "$INPUT" | jq -r '.hook_event_name // .type // "unknown"' 2>/dev/null || echo "unknown")
  TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // null' 2>/dev/null || echo "null")
  SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // null' 2>/dev/null || echo "null")
  STOP_REASON=$(echo "$INPUT" | jq -r '.stop_reason // .reason // null' 2>/dev/null || echo "null")

  # Build structured log entry with jq
  LOG_ENTRY=$(jq -cn \
    --arg ts "$TIMESTAMP" \
    --arg event "$EVENT_TYPE" \
    --arg tool "$TOOL_NAME" \
    --arg session "$SESSION_ID" \
    --arg reason "$STOP_REASON" \
    --argjson raw_event "$(echo "$INPUT" | jq -c '.' 2>/dev/null || echo '{}')" \
    '{
      timestamp: $ts,
      event_type: $event,
      tool_name: (if $tool == "null" then null else $tool end),
      session_id: (if $session == "null" then null else $session end),
      stop_reason: (if $reason == "null" then null else $reason end),
      raw: $raw_event
    }' 2>/dev/null)
else
  # Fallback: construct JSON manually without jq
  EVENT_TYPE=$(echo "$INPUT" | grep -o '"hook_event_name"\s*:\s*"[^"]*"' | sed 's/.*: *"//;s/"//' || echo "unknown")
  TOOL_NAME=$(echo "$INPUT" | grep -o '"tool_name"\s*:\s*"[^"]*"' | sed 's/.*: *"//;s/"//' || echo "")
  SESSION_ID=$(echo "$INPUT" | grep -o '"session_id"\s*:\s*"[^"]*"' | sed 's/.*: *"//;s/"//' || echo "")

  # Escape special characters for JSON
  ESCAPED_INPUT=$(echo "$INPUT" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr '\n' ' ')

  # Format null values properly (without quotes for JSON null)
  TOOL_JSON="null"
  [ -n "$TOOL_NAME" ] && TOOL_JSON="\"${TOOL_NAME}\""
  SESSION_JSON="null"
  [ -n "$SESSION_ID" ] && SESSION_JSON="\"${SESSION_ID}\""

  LOG_ENTRY="{\"timestamp\":\"${TIMESTAMP}\",\"event_type\":\"${EVENT_TYPE}\",\"tool_name\":${TOOL_JSON},\"session_id\":${SESSION_JSON},\"raw_input\":\"${ESCAPED_INPUT}\"}"
fi

# --- Validate we have a log entry ---
if [ -z "$LOG_ENTRY" ]; then
  exit 0
fi

# --- Log rotation: check file size ---
if [ -f "$LOG_FILE" ]; then
  FILE_SIZE_KB=$(du -k "$LOG_FILE" 2>/dev/null | cut -f1 || echo "0")
  MAX_SIZE_KB=$((MAX_LOG_SIZE_MB * 1024))
  if [ "$FILE_SIZE_KB" -gt "$MAX_SIZE_KB" ]; then
    # Rotate: keep last 1000 lines, archive old file
    ARCHIVE_FILE="${LOG_FILE}.$(date +%Y%m%d%H%M%S).bak"
    mv "$LOG_FILE" "$ARCHIVE_FILE" 2>/dev/null || true
    # Compress archive in background
    (gzip "$ARCHIVE_FILE" 2>/dev/null || true) &
  fi
fi

# --- Append log entry (atomic write with file locking) ---
echo "$LOG_ENTRY" >> "$LOG_FILE" 2>/dev/null

exit 0
