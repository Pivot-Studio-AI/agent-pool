#!/usr/bin/env bash
# Smoke tests for .gitignore completeness and correctness
# Tests verify the expanded .gitignore covers all expected categories

set -euo pipefail

GITIGNORE="$(dirname "$0")/../.gitignore"
PASS=0
FAIL=0

assert_pattern() {
  local pattern="$1"
  local desc="$2"
  if grep -qF "$pattern" "$GITIGNORE" 2>/dev/null; then
    echo "  PASS: $desc"
    ((PASS++))
  else
    echo "  FAIL: $desc (pattern '$pattern' not found)"
    ((FAIL++))
  fi
}

assert_not_tracked() {
  local path="$1"
  local desc="$2"
  # Use git check-ignore to verify the path would be ignored
  if git check-ignore -q "$path" 2>/dev/null; then
    echo "  PASS: $desc"
    ((PASS++))
  else
    echo "  FAIL: $desc ('$path' is not ignored by git)"
    ((FAIL++))
  fi
}

echo "=== .gitignore Smoke Tests ==="
echo ""

echo "--- Test: File exists and is non-empty ---"
if [ -s "$GITIGNORE" ]; then
  echo "  PASS: .gitignore exists and is non-empty"
  ((PASS++))
else
  echo "  FAIL: .gitignore missing or empty"
  ((FAIL++))
fi

echo ""
echo "--- Test: Core patterns present ---"
assert_pattern "node_modules/" "node_modules ignored"
assert_pattern "dist/" "dist build output ignored"
assert_pattern ".env" "env file ignored"
assert_pattern "*.tsbuildinfo" "TypeScript build info ignored"

echo ""
echo "--- Test: New patterns from expansion ---"
assert_pattern "build/" "build directory ignored"
assert_pattern ".env.local" "local env ignored"
assert_pattern ".env.*.local" "environment-specific local env ignored"
assert_pattern "pgdata/" "PostgreSQL data ignored"
assert_pattern ".worktrees/" "worktrees ignored"
assert_pattern "logs/" "logs directory ignored"
assert_pattern "*.log" "log files ignored"
assert_pattern "coverage/" "coverage directory ignored"
assert_pattern ".vscode/" "VS Code config ignored"
assert_pattern ".idea/" "JetBrains config ignored"
assert_pattern "*.swp" "vim swap files ignored"
assert_pattern ".DS_Store" "macOS DS_Store ignored"
assert_pattern "Thumbs.db" "Windows thumbnails ignored"
assert_pattern "packages/dashboard/.vite/" "Vite cache ignored"
assert_pattern ".agent-status" "agent status file ignored"

echo ""
echo "--- Test: git check-ignore verification ---"
assert_not_tracked "node_modules/foo" "node_modules/ is git-ignored"
assert_not_tracked ".env" ".env is git-ignored"
assert_not_tracked ".env.local" ".env.local is git-ignored"
assert_not_tracked ".env.production.local" ".env.*.local is git-ignored"
assert_not_tracked "dist/bundle.js" "dist/ is git-ignored"
assert_not_tracked "build/output.js" "build/ is git-ignored"
assert_not_tracked "coverage/lcov.info" "coverage/ is git-ignored"
assert_not_tracked ".DS_Store" ".DS_Store is git-ignored"
assert_not_tracked "packages/dashboard/.vite/cache" "Vite cache is git-ignored"
assert_not_tracked "server.log" "*.log files are git-ignored"
assert_not_tracked ".agent-status" ".agent-status is git-ignored"

echo ""
echo "--- Test: Organized with section comments ---"
COMMENT_COUNT=$(grep -c '^#' "$GITIGNORE" || true)
if [ "$COMMENT_COUNT" -ge 5 ]; then
  echo "  PASS: Has $COMMENT_COUNT comment lines (organized with sections)"
  ((PASS++))
else
  echo "  FAIL: Only $COMMENT_COUNT comment lines (expected organized sections)"
  ((FAIL++))
fi

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
