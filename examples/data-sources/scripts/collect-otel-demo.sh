#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DATASET_DIR="$PROJECT_DIR/data/otel-demo"
RAW_DIR="$DATASET_DIR/raw"
DEMO_DIR="$DATASET_DIR/runtime/opentelemetry-demo"
DEMO_REPOSITORY="https://github.com/open-telemetry/opentelemetry-demo.git"
DEMO_REF="main"
DURATION=300
WARMUP=60
SCENARIO="baseline"
STACK="minimal"
MAX_START_ATTEMPTS=3

usage() {
  cat <<'EOF'
Usage: bash scripts/collect-otel-demo.sh [options]

Options:
  --duration <seconds>   Capture duration after warmup (default: 300)
  --warmup <seconds>     Demo warmup duration before capture (default: 60)
  --ref <git-ref>        OpenTelemetry Demo branch, tag, or commit (default: main)
  --scenario <label>     Scenario label stored in the manifest (default: baseline)
  --stack <mode>         Demo stack: minimal or full (default: minimal)
  --demo-dir <path>      Reuse a specific OpenTelemetry Demo checkout
  --help                 Show this help

The minimal stack includes the official services, load generator, and Collector.
Use --stack full to also start Kafka and the observability backends. During
capture, faults can be enabled from http://localhost:8080/feature. The stack is
stopped after collection.
EOF
}

while (($#)); do
  case "$1" in
    --duration) DURATION="${2:?--duration requires seconds}"; shift 2 ;;
    --warmup) WARMUP="${2:?--warmup requires seconds}"; shift 2 ;;
    --ref) DEMO_REF="${2:?--ref requires a git ref}"; shift 2 ;;
    --scenario) SCENARIO="${2:?--scenario requires a label}"; shift 2 ;;
    --stack) STACK="${2:?--stack requires minimal or full}"; shift 2 ;;
    --demo-dir) DEMO_DIR="${2:?--demo-dir requires a path}"; shift 2 ;;
    --help) usage; exit 0 ;;
    --) shift ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 1 ;;
  esac
done

[[ "$DURATION" =~ ^[1-9][0-9]*$ ]] || { echo "--duration must be a positive integer" >&2; exit 1; }
[[ "$WARMUP" =~ ^[0-9]+$ ]] || { echo "--warmup must be a non-negative integer" >&2; exit 1; }
[[ "$STACK" == "minimal" || "$STACK" == "full" ]] || { echo "--stack must be minimal or full" >&2; exit 1; }
command -v git >/dev/null || { echo "git is required" >&2; exit 1; }
command -v docker >/dev/null || { echo "Docker is required" >&2; exit 1; }
command -v node >/dev/null || { echo "Node.js is required" >&2; exit 1; }
if command -v shasum >/dev/null 2>&1; then
  sha256_files() { shasum -a 256 "$@"; }
elif command -v sha256sum >/dev/null 2>&1; then
  sha256_files() { sha256sum "$@"; }
else
  echo "shasum or sha256sum is required" >&2
  exit 1
fi
docker compose version >/dev/null
docker info >/dev/null

mkdir -p "$(dirname "$DEMO_DIR")" "$RAW_DIR"
if [[ ! -d "$DEMO_DIR/.git" ]]; then
  git clone --filter=blob:none "$DEMO_REPOSITORY" "$DEMO_DIR"
fi
if [[ -n "$(git -C "$DEMO_DIR" status --porcelain)" ]]; then
  echo "OpenTelemetry Demo checkout has local changes: $DEMO_DIR" >&2
  echo "Use a clean checkout or pass --demo-dir with another path." >&2
  exit 1
fi

git -C "$DEMO_DIR" fetch --depth 1 origin "$DEMO_REF"
git -C "$DEMO_DIR" checkout --detach FETCH_HEAD
REVISION="$(git -C "$DEMO_DIR" rev-parse HEAD)"
CAPTURE_ID="$(date -u '+%Y%m%dT%H%M%SZ')-${REVISION:0:8}"
CAPTURE_DIR="$RAW_DIR/$CAPTURE_ID"
COLLECTOR_CONFIG="$CAPTURE_DIR/otelcol-capture.yml"
COMPOSE_OVERRIDE="$CAPTURE_DIR/compose.capture.yml"
MANIFEST="$CAPTURE_DIR/manifest.json"
mkdir -p "$CAPTURE_DIR"

TRACE_EXPORTERS="debug, span_metrics, file/traces"
METRIC_EXPORTERS="debug, file/metrics"
LOG_EXPORTERS="debug, file/logs"
if [[ "$STACK" == "full" ]]; then
  TRACE_EXPORTERS="debug, otlp_grpc/jaeger, span_metrics, file/traces"
  METRIC_EXPORTERS="debug, otlp_http/prometheus, file/metrics"
  LOG_EXPORTERS="debug, opensearch, file/logs"
fi

cat > "$COLLECTOR_CONFIG" <<EOF
exporters:
  file/traces:
    path: /export/traces.jsonl
    format: json
    flush_interval: 1s
    create_directory: true
  file/metrics:
    path: /export/metrics.jsonl
    format: json
    flush_interval: 1s
    create_directory: true
  file/logs:
    path: /export/logs.jsonl
    format: json
    flush_interval: 1s
    create_directory: true

service:
  pipelines:
    traces:
      exporters: [$TRACE_EXPORTERS]
    metrics:
      exporters: [$METRIC_EXPORTERS]
    logs:
      exporters: [$LOG_EXPORTERS]
EOF

COLLECTOR_CONFIGS=(
  --config=/etc/otelcol-config.yml
)
if [[ "$STACK" == "full" ]]; then
  COLLECTOR_CONFIGS+=(
    --config=/etc/otelcol-config-full.yml
    --config=/etc/otelcol-config-observability.yml
  )
fi
COLLECTOR_CONFIGS+=(
  --config=/etc/otelcol-config-extras.yml
  --config=/etc/otelcol-config-capture.yml
  --feature-gates=service.profilesSupport
)

{
  cat <<EOF
services:
  otel-collector:
    command:
EOF
  printf '      - %s\n' "${COLLECTOR_CONFIGS[@]}"
  cat <<EOF
    volumes:
      - "$COLLECTOR_CONFIG:/etc/otelcol-config-capture.yml:ro"
      - "$CAPTURE_DIR:/export"
EOF
} > "$COMPOSE_OVERRIDE"

COMPOSE=(
  docker compose
  --env-file "$DEMO_DIR/.env"
)
if [[ -f "$DEMO_DIR/.env.override" ]]; then
  COMPOSE+=(--env-file "$DEMO_DIR/.env.override")
fi
COMPOSE+=(
  -f "$DEMO_DIR/compose.yaml"
)
if [[ "$STACK" == "full" ]]; then
  COMPOSE+=(
    -f "$DEMO_DIR/compose.full.yaml"
    -f "$DEMO_DIR/compose.observability.yaml"
  )
fi
COMPOSE+=(-f "$COMPOSE_OVERRIDE")
export COMPOSE_PARALLEL_LIMIT="${COMPOSE_PARALLEL_LIMIT:-4}"
export COMPOSE_PROGRESS="${COMPOSE_PROGRESS:-plain}"

cleanup() {
  "${COMPOSE[@]}" down --remove-orphans >/dev/null 2>&1 || true
}

start_stack() {
  local attempt=1
  while ! "${COMPOSE[@]}" up --force-recreate --remove-orphans --detach; do
    if ((attempt >= MAX_START_ATTEMPTS)); then
      echo "otel-demo: Compose failed after ${MAX_START_ATTEMPTS} attempts" >&2
      return 1
    fi
    echo "otel-demo: Compose start failed; retrying cached layers ($attempt/$MAX_START_ATTEMPTS)" >&2
    sleep $((attempt * 5))
    attempt=$((attempt + 1))
  done
}

trap cleanup EXIT
trap 'exit 130' INT TERM

echo "otel-demo: starting ${STACK} stack at revision ${REVISION:0:12}"
start_stack
if ((WARMUP > 0)); then
  echo "otel-demo: warming up for ${WARMUP}s"
  sleep "$WARMUP"
fi

# Restart the collector so startup telemetry does not contaminate the capture window.
"${COMPOSE[@]}" stop otel-collector
rm -f "$CAPTURE_DIR/traces.jsonl" "$CAPTURE_DIR/metrics.jsonl" "$CAPTURE_DIR/logs.jsonl"
"${COMPOSE[@]}" up --detach otel-collector

STARTED_AT="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "otel-demo: capturing ${SCENARIO} for ${DURATION}s"
echo "otel-demo: fault controls are available at http://localhost:8080/feature"
sleep "$DURATION"
"${COMPOSE[@]}" stop otel-collector
ENDED_AT="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

for signal in traces metrics logs; do
  [[ -s "$CAPTURE_DIR/$signal.jsonl" ]] || {
    echo "otel-demo: no $signal telemetry was captured" >&2
    exit 1
  }
done

node - "$MANIFEST" "$CAPTURE_ID" "$REVISION" "$STARTED_AT" "$ENDED_AT" "$DURATION" "$WARMUP" "$SCENARIO" "$STACK" <<'NODE'
const fs = require('node:fs');
const [manifestPath, captureId, revision, startedAt, endedAt, duration, warmup, scenario, stack] = process.argv.slice(2);
const manifest = {
  datasetId: 'otel-demo',
  captureId,
  source: {
    repository: 'https://github.com/open-telemetry/opentelemetry-demo.git',
    revision,
    license: 'Apache-2.0'
  },
  startedAt,
  endedAt,
  durationSeconds: Number(duration),
  warmupSeconds: Number(warmup),
  scenario,
  stack,
  files: ['traces.jsonl', 'metrics.jsonl', 'logs.jsonl'],
  limitations: [
    'Telemetry was generated by the OpenTelemetry Demo and is not production data.',
    'The scenario label records operator intent; conclusions still require telemetry evidence.'
  ]
};
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
NODE

(
  cd "$CAPTURE_DIR"
  sha256_files traces.jsonl metrics.jsonl logs.jsonl manifest.json > checksums.sha256
)
trap - EXIT INT TERM
cleanup
echo "otel-demo: capture written to $CAPTURE_DIR"
