#!/bin/bash
# =============================================================================
# 공통 유틸리티 함수 라이브러리
# Claude Code Hooks에서 사용하는 공통 헬퍼 모음
# =============================================================================

# --- 도구 존재 여부 확인 ---
HAS_JQ=false
if command -v jq &>/dev/null; then
  HAS_JQ=true
fi

# --- JSON 파싱 헬퍼 ---
# jq가 있으면 jq 사용, 없으면 grep/sed 폴백
json_get() {
  local json="$1"
  local key="$2"

  if $HAS_JQ; then
    echo "$json" | jq -r ".$key // empty" 2>/dev/null
  else
    # jq 없을 때 간단한 폴백 (중첩 키는 지원하지 않음)
    echo "$json" | grep -o "\"$key\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" 2>/dev/null | head -1 | sed 's/.*:[[:space:]]*"\(.*\)"/\1/' || true
  fi
}

# 중첩 키 접근 (예: event.tool_name)
json_get_nested() {
  local json="$1"
  local path="$2"

  if $HAS_JQ; then
    echo "$json" | jq -r ".$path // empty" 2>/dev/null || true
  else
    # 폴백: 마지막 키만 추출
    local last_key="${path##*.}"
    json_get "$json" "$last_key"
  fi
}

# 숫자 값 추출
json_get_number() {
  local json="$1"
  local key="$2"

  if $HAS_JQ; then
    echo "$json" | jq -r ".$key // 0" 2>/dev/null || echo "0"
  else
    echo "$json" | grep -o "\"$key\"[[:space:]]*:[[:space:]]*[0-9.]*" 2>/dev/null | head -1 | sed 's/.*:[[:space:]]*//' || echo "0"
  fi
}

# --- 타임스탬프 포맷팅 ---
# ISO 8601 형식의 현재 시간
now_iso() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

# Unix epoch (밀리초)
now_epoch_ms() {
  if [[ "$(uname)" == "Darwin" ]]; then
    # macOS: python 폴백 (milliseconds)
    python3 -c "import time; print(int(time.time() * 1000))" 2>/dev/null || echo "$(date +%s)000"
  else
    date +%s%3N 2>/dev/null || echo "$(date +%s)000"
  fi
}

# 날짜만 추출 (YYYY-MM-DD)
today_date() {
  date -u +"%Y-%m-%d"
}

# --- 로그 레벨 함수 ---
# 로그 출력 대상: stderr (stdout은 hook 결과용)
_log() {
  local level="$1"
  shift
  echo "[$(now_iso)] [$level] $*" >&2
}

log_info() {
  _log "INFO" "$@"
}

log_warn() {
  _log "WARN" "$@"
}

log_error() {
  _log "ERROR" "$@"
}

# --- 필수 도구 확인 ---
check_required_tools() {
  local missing=()
  for tool in "$@"; do
    if ! command -v "$tool" &>/dev/null; then
      missing+=("$tool")
    fi
  done

  if [[ ${#missing[@]} -gt 0 ]]; then
    log_warn "Missing tools: ${missing[*]} — some features may be degraded"
    return 1
  fi
  return 0
}

# --- UUID 생성 (간이) ---
generate_trace_id() {
  if command -v uuidgen &>/dev/null; then
    uuidgen | tr '[:upper:]' '[:lower:]'
  else
    # 폴백: /dev/urandom 기반
    cat /dev/urandom 2>/dev/null | LC_ALL=C tr -dc 'a-f0-9' | head -c 32 | sed 's/\(.\{8\}\)\(.\{4\}\)\(.\{4\}\)\(.\{4\}\)/\1-\2-\3-\4-/'
  fi
}

# --- stdin에서 이벤트 JSON 읽기 ---
read_event_json() {
  local input=""
  if [[ ! -t 0 ]]; then
    input=$(cat)
  fi
  echo "$input"
}
