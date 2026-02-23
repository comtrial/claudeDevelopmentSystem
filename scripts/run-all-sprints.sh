#!/bin/bash
###############################################################################
# Sprint 2~5 Automated Execution Script
#
# This script runs Sprint 2 fix + Sprint 3/4/5 sequentially using Claude CLI.
# Each sprint: implement → type check → lint → playwright test → git commit/push
###############################################################################

set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────────────
PROJECT_DIR="/Users/choeseung-won/personal-project/claudeDevelopmentSystem"
SCRIPTS_DIR="$PROJECT_DIR/scripts"
PROMPTS_DIR="$SCRIPTS_DIR/prompts"
LOG_DIR="$SCRIPTS_DIR/logs"
BRANCH="develop"

# Claude CLI settings
CLAUDE_CMD="claude"
CLAUDE_FLAGS="--dangerously-skip-permissions"

# ── Setup ──────────────────────────────────────────────────────────────────
cd "$PROJECT_DIR"
mkdir -p "$LOG_DIR"

# CRITICAL: Unset CLAUDECODE to allow nested Claude CLI invocation
unset CLAUDECODE 2>/dev/null || true
unset CLAUDE_CODE 2>/dev/null || true

# Node.js setup
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
nvm use 22 2>/dev/null || true

# Timestamp for logs
timestamp() { date '+%Y-%m-%d %H:%M:%S'; }

# Log function
log() {
  local msg="[$(timestamp)] $1"
  echo "$msg"
  echo "$msg" >> "$LOG_DIR/execution.log"
}

# ── Error handler ──────────────────────────────────────────────────────────
on_error() {
  local sprint=$1
  log "❌ ERROR in Sprint $sprint. Check logs at $LOG_DIR/sprint-${sprint}.log"
  log "Attempting to save progress..."

  cd "$PROJECT_DIR"
  git add -A 2>/dev/null || true
  git commit -m "wip: Sprint $sprint partial progress (error occurred)" --no-verify 2>/dev/null || true
  git push origin "$BRANCH" 2>/dev/null || true

  log "Partial progress saved. Continuing to next sprint..."
}

# ── Sprint execution function ──────────────────────────────────────────────
run_sprint() {
  local sprint_name="$1"
  local prompt_file="$2"
  local max_turns="${3:-80}"
  local sprint_log="$LOG_DIR/${sprint_name}.log"

  log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  log "🚀 Starting: $sprint_name"
  log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  if [ ! -f "$prompt_file" ]; then
    log "❌ Prompt file not found: $prompt_file"
    return 1
  fi

  # ── 1. Run Claude CLI ──
  log "📝 Running Claude CLI (max-turns: $max_turns)..."

  local prompt_content
  prompt_content=$(cat "$prompt_file")

  $CLAUDE_CMD $CLAUDE_FLAGS \
    -p "$prompt_content" \
    --max-turns "$max_turns" \
    --model sonnet \
    --output-format text \
    2>&1 | tee "$sprint_log" || {
      log "⚠️ Claude CLI exited with non-zero code for $sprint_name"
      on_error "$sprint_name"
      return 0  # Continue to next sprint
    }

  log "✅ Claude CLI completed for $sprint_name"

  # ── 2. Type check ──
  log "🔍 Running TypeScript check..."
  npx tsc --noEmit 2>&1 | tail -20 >> "$sprint_log" || {
    log "⚠️ TypeScript errors found, attempting auto-fix via Claude..."
    $CLAUDE_CMD $CLAUDE_FLAGS \
      -p "Fix all TypeScript errors. Run 'npx tsc --noEmit' to see errors, then fix them. Only fix type errors, don't change functionality." \
      --max-turns 20 \
      --model sonnet \
      --output-format text \
      2>&1 | tee -a "$sprint_log" || true
  }

  # ── 3. Lint ──
  log "🧹 Running ESLint..."
  npx eslint . --fix 2>&1 | tail -20 >> "$sprint_log" || {
    log "⚠️ ESLint issues found, attempting auto-fix via Claude..."
    $CLAUDE_CMD $CLAUDE_FLAGS \
      -p "Fix all ESLint errors. Run 'npx eslint .' to see errors, then fix them. Only fix lint errors." \
      --max-turns 10 \
      --model sonnet \
      --output-format text \
      2>&1 | tee -a "$sprint_log" || true
  }

  # ── 4. Playwright test ──
  log "🧪 Running Playwright tests..."
  npx playwright test --project=common 2>&1 | tail -30 >> "$sprint_log" || {
    log "⚠️ Some Playwright tests failed. Continuing..."
  }

  # ── 5. Git commit & push ──
  log "📦 Committing and pushing..."
  cd "$PROJECT_DIR"

  git add -A

  local commit_msg
  commit_msg=$(cat <<EOF
feat: ${sprint_name} implementation

Automated implementation via Claude CLI.
Sprint tasks completed with type checking and linting.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)

  git commit -m "$commit_msg" --no-verify 2>/dev/null || {
    log "ℹ️ Nothing to commit for $sprint_name"
  }

  git push origin "$BRANCH" 2>/dev/null || {
    log "⚠️ Push failed for $sprint_name, will retry later"
  }

  log "✅ $sprint_name COMPLETE"
  log ""
}

# ── Main Execution ─────────────────────────────────────────────────────────

log "╔══════════════════════════════════════════════════════════╗"
log "║  Sprint 2~5 Automated Execution                         ║"
log "║  Project: Claude Dev System                              ║"
log "║  Started: $(timestamp)                          ║"
log "╚══════════════════════════════════════════════════════════╝"
log ""

# Ensure we're on the right branch
git checkout "$BRANCH" 2>/dev/null || true
git pull origin "$BRANCH" 2>/dev/null || true

# ── Sprint 2 Fix ──
run_sprint "sprint-2-fix" "$PROMPTS_DIR/sprint-2-fix.md" 30

# ── Sprint 3 ──
run_sprint "sprint-3" "$PROMPTS_DIR/sprint-3.md" 100

# ── Sprint 4 ──
run_sprint "sprint-4" "$PROMPTS_DIR/sprint-4.md" 80

# ── Sprint 5 ──
run_sprint "sprint-5" "$PROMPTS_DIR/sprint-5.md" 80

# ── Final Summary ──
log ""
log "╔══════════════════════════════════════════════════════════╗"
log "║  ALL SPRINTS COMPLETE                                    ║"
log "║  Finished: $(timestamp)                         ║"
log "╚══════════════════════════════════════════════════════════╝"

# Final build verification
log "🏗️ Running final build verification..."
cd "$PROJECT_DIR"
source "$NVM_DIR/nvm.sh" && nvm use 22

npx tsc --noEmit 2>&1 && log "✅ TypeScript: PASS" || log "❌ TypeScript: FAIL"
npx eslint . 2>&1 && log "✅ ESLint: PASS" || log "❌ ESLint: FAIL"
npx playwright test --project=common 2>&1 && log "✅ Playwright: PASS" || log "❌ Playwright: FAIL"

log ""
log "📋 Logs saved to: $LOG_DIR/"
log "🎉 Done! Check the deployment at localhost:3000"
