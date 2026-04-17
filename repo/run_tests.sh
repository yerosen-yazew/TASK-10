#!/usr/bin/env bash
# ForgeRoom — Test runner (Docker Compose only)
# Runs the frontend Vitest suite through docker compose using the
# `frontend-tests` service.
# There is no backend — ForgeRoom is a pure frontend SPA, so only frontend
# unit tests are executed.
#
# Usage:
#   bash repo/run_tests.sh               # run unit/integration suite
#   bash repo/run_tests.sh --coverage    # run unit/integration with V8 coverage
#   bash repo/run_tests.sh --e2e         # run Playwright browser journey suite
#   bash repo/run_tests.sh --all         # run coverage + e2e suites
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

MODE="test"
RUN_UNIT="true"
RUN_E2E="false"

for arg in "$@"; do
  case "$arg" in
    --coverage)
      MODE="test:coverage"
      ;;
    --e2e)
      RUN_UNIT="false"
      RUN_E2E="true"
      ;;
    --all)
      MODE="test:coverage"
      RUN_UNIT="true"
      RUN_E2E="true"
      ;;
    --help)
      echo "Usage: bash repo/run_tests.sh [--coverage|--e2e|--all]"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg"
      echo "Usage: bash repo/run_tests.sh [--coverage|--e2e|--all]"
      exit 1
      ;;
  esac
done

echo "=== ForgeRoom Test Runner ==="

cd "$SCRIPT_DIR"

if [[ "$RUN_UNIT" == "true" ]]; then
  echo "Running frontend unit/integration tests in Docker Compose service (frontend-tests) [mode: $MODE]..."
  COMPOSE_IGNORE_ORPHANS=True TEST_MODE="$MODE" docker compose --profile test run --rm frontend-tests
fi

if [[ "$RUN_E2E" == "true" ]]; then
  echo "Running browser e2e tests in Docker Compose service (frontend-e2e)..."
  COMPOSE_IGNORE_ORPHANS=True docker compose --profile e2e run --rm frontend-e2e
fi

echo "=== Tests complete ==="
