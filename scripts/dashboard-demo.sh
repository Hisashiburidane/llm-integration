#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_PROJECT="$ROOT_DIR/examples/data-sources"
DATA_DIR="$DATA_PROJECT/data"
DASHBOARD_PROJECT="$ROOT_DIR/examples/dashboard-vue"
DASHBOARD_DATASETS=(
  aviation-ontime
  beijing-air-quality
  nyc-taxi
)
PROCESS_DATASETS=(
  aviation-ontime
  beijing-air-quality
  nyc-taxi
  otel-demo
)

INSTALL=1
DOWNLOAD=1
FORCE_DOWNLOAD=0
COLLECT_OTEL=1
REFRESH_OTEL=0
PREPARE_ONLY=0
OTEL_DURATION=300
OTEL_WARMUP=60
OTEL_SCENARIO=baseline

usage() {
  cat <<'EOF'
Usage: pnpm demo [-- options]

Prepare all data used by Dashboard Vue, initialize its configuration, build the
EnchantForge Vue library, and start the Dashboard development servers.

Options:
  --prepare-only             Prepare the database and configuration without starting dev
  --skip-install             Reuse the current node_modules instead of running pnpm install
  --skip-download            Reuse existing aviation, air-quality, and taxi source files
  --force-download           Replace existing public source files
  --skip-otel                Reuse an existing OTel capture; fail if none is available
  --refresh-otel             Collect a new OTel capture even when one already exists
  --otel-duration <seconds>  OTel capture duration (default: 300)
  --otel-warmup <seconds>    OTel warmup duration (default: 60)
  --otel-scenario <label>    Scenario label stored with the capture (default: baseline)
  -h, --help                 Show this help

The first run downloads the three public datasets and, when needed, starts the
official OpenTelemetry Demo with Docker. Existing downloads and valid OTel
captures are reused by default. Shell proxy variables are inherited by curl,
git, Docker, pnpm, and uv.
EOF
}

while (($#)); do
  case "$1" in
    --prepare-only) PREPARE_ONLY=1; shift ;;
    --skip-install) INSTALL=0; shift ;;
    --skip-download) DOWNLOAD=0; shift ;;
    --force-download) FORCE_DOWNLOAD=1; shift ;;
    --skip-otel) COLLECT_OTEL=0; shift ;;
    --refresh-otel) REFRESH_OTEL=1; shift ;;
    --otel-duration) OTEL_DURATION="${2:?--otel-duration requires seconds}"; shift 2 ;;
    --otel-warmup) OTEL_WARMUP="${2:?--otel-warmup requires seconds}"; shift 2 ;;
    --otel-scenario) OTEL_SCENARIO="${2:?--otel-scenario requires a label}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    --) shift ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 1 ;;
  esac
done

[[ "$OTEL_DURATION" =~ ^[1-9][0-9]*$ ]] || { echo "--otel-duration must be a positive integer" >&2; exit 1; }
[[ "$OTEL_WARMUP" =~ ^[0-9]+$ ]] || { echo "--otel-warmup must be a non-negative integer" >&2; exit 1; }

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Required command not found: $1" >&2
    exit 1
  }
}

step() {
  printf '\n\033[1;36m[EnchantForge demo]\033[0m %s\n' "$1"
}

has_otel_capture() {
  local manifest capture_dir
  shopt -s nullglob
  for manifest in "$DATA_DIR"/otel-demo/raw/*/manifest.json; do
    capture_dir="$(dirname "$manifest")"
    if [[ -s "$capture_dir/traces.jsonl" && -s "$capture_dir/metrics.jsonl" && -s "$capture_dir/logs.jsonl" ]]; then
      shopt -u nullglob
      return 0
    fi
  done
  shopt -u nullglob
  return 1
}

require_command pnpm
require_command node
require_command uv
require_command sqlite3

cd "$ROOT_DIR"

if ((INSTALL)); then
  step "Installing workspace dependencies"
  pnpm install --frozen-lockfile
fi

if ((DOWNLOAD)); then
  step "Preparing public Dashboard datasets"
  for dataset in "${DASHBOARD_DATASETS[@]}"; do
    node "$DATA_PROJECT/scripts/generate-data-plans.mjs" --dataset "$dataset"
    download_args=(--dataset "$dataset")
    if ((FORCE_DOWNLOAD)); then
      download_args+=(--force)
    fi
    bash "$DATA_PROJECT/scripts/download-data-plans.sh" "${download_args[@]}"
  done
fi

if ((REFRESH_OTEL)) || ! has_otel_capture; then
  if ((!COLLECT_OTEL)); then
    echo "No valid OpenTelemetry capture is available and --skip-otel was specified." >&2
    exit 1
  fi
  step "Collecting OpenTelemetry Demo signals"
  bash "$DATA_PROJECT/scripts/collect-otel-demo.sh" \
    --duration "$OTEL_DURATION" \
    --warmup "$OTEL_WARMUP" \
    --scenario "$OTEL_SCENARIO"
else
  step "Reusing an existing OpenTelemetry capture"
fi

step "Cleaning all four Dashboard datasets into SQLite"
for dataset in "${PROCESS_DATASETS[@]}"; do
  bash "$DATA_PROJECT/scripts/run-process-data.sh" --dataset "$dataset" --strict
done

step "Restoring Dashboard and Panel configuration"
node "$DASHBOARD_PROJECT/scripts/reset-dashboard-config.mjs"

step "Building @enchantforge/vue"
pnpm build:lib

if ((PREPARE_ONLY)); then
  step "Dashboard data and configuration are ready"
  printf 'Run pnpm dev:dashboard to start the application.\n'
  exit 0
fi

if [[ ! -f "$DASHBOARD_PROJECT/.env" ]]; then
  printf '\n[EnchantForge demo] Warning: %s is missing. The Dashboard will run, but Aura requires an OpenAI-compatible LLM configuration.\n' "$DASHBOARD_PROJECT/.env" >&2
fi

step "Starting Dashboard Vue at http://127.0.0.1:5175/dashboard/"
exec pnpm --filter @enchantforge/dashboard-vue dev
