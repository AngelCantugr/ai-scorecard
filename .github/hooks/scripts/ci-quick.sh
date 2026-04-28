#!/bin/bash
# Quick CI gate for subagentStop.
# Skips build and tests — build artifacts may not exist mid-loop, and
# the developer agent runs pnpm test internally before marking work done.
# Lint + typecheck are fast and catch the most common mistakes early.
set -uo pipefail

output=$(pnpm lint && \
         pnpm exec prettier --check "**/*.{ts,tsx,js,jsx,json,md}" && \
         pnpm typecheck 2>&1) || {
  jq -n --arg r "Quick CI check failed. Fix before finishing:

$output" '{"decision":"block","reason":$r}'
  exit 0
}

echo '{"decision":"approve"}'
