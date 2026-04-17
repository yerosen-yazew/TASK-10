#!/usr/bin/env bash
# ForgeRoom — Test runner (Docker-first)
# Runs the frontend Vitest suite inside a clean node:20-alpine container.
# There is no backend — ForgeRoom is a pure frontend SPA, so only frontend
# unit tests are executed.
#
# Usage:
#   bash repo/run_tests.sh               # run the suite
#   bash repo/run_tests.sh --coverage    # run with V8 coverage (>=90% target)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

MODE="test"
if [[ "${1:-}" == "--coverage" ]]; then
  MODE="test:coverage"
fi

echo "=== ForgeRoom Test Runner (mode: $MODE) ==="
echo "Running frontend unit tests in Docker (node:20-alpine)..."

docker run --rm \
  -w /app \
  -v "$FRONTEND_DIR":/app \
  node:20-alpine \
  sh -c "npm install && npm run $MODE"

echo "=== Tests complete ==="
