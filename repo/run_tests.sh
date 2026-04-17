#!/usr/bin/env bash
# ForgeRoom — Test runner (Docker Compose only)
# Runs the frontend Vitest suite through docker compose using the
# `frontend-tests` service.
# There is no backend — ForgeRoom is a pure frontend SPA, so only frontend
# unit tests are executed.
#
# Usage:
#   bash repo/run_tests.sh               # run the suite
#   bash repo/run_tests.sh --coverage    # run with V8 coverage (>=90% target)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

MODE="test"
if [[ "${1:-}" == "--coverage" ]]; then
  MODE="test:coverage"
fi

echo "=== ForgeRoom Test Runner (mode: $MODE) ==="
echo "Running frontend unit tests in Docker Compose service (frontend-tests)..."

cd "$SCRIPT_DIR"
TEST_MODE="$MODE" docker compose --profile test run --rm frontend-tests

echo "=== Tests complete ==="
