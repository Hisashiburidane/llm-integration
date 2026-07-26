#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [[ "${1:-}" == "--" ]]; then
  shift
fi

cd "$PROJECT_DIR"
exec uv run python scripts/process-data.py "$@"
