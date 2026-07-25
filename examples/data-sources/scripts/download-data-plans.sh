#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$(cd "$SCRIPT_DIR/../data" && pwd)"
DATASET=""
FORCE=0

while (($#)); do
  case "$1" in
    --dataset) DATASET="${2:?--dataset requires an id}"; shift 2 ;;
    --force) FORCE=1; shift ;;
    --help) echo 'Usage: bash scripts/download-data-plans.sh [--dataset <id>] [--force]'; exit 0 ;;
    --) shift ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

if command -v shasum >/dev/null 2>&1; then
  sha256() { shasum -a 256 "$1" | awk '{print $1}'; }
elif command -v sha256sum >/dev/null 2>&1; then
  sha256() { sha256sum "$1" | awk '{print $1}'; }
else
  echo 'Neither shasum nor sha256sum is available.' >&2
  exit 1
fi

download_plan() {
  local id="$1"
  local url_file="$DATA_DIR/$id/download-urls.txt"
  local raw_dir="$DATA_DIR/$id/raw"
  local checksum_file="$DATA_DIR/$id/checksums.sha256"
  [[ -f "$url_file" ]] || { echo "$id: plan missing; run data:plan first" >&2; return 1; }
  if [[ ! -s "$url_file" ]]; then
    echo "$id: no direct URL; follow data/$id/download-plan.json"
    return 0
  fi
  mkdir -p "$raw_dir"
  : > "$checksum_file"
  while IFS= read -r url || [[ -n "$url" ]]; do
    [[ -z "$url" ]] && continue
    local name="${url##*/}"
    local destination="$raw_dir/$name"
    local temporary="$destination.part"
    if [[ -f "$destination" && "$FORCE" -eq 0 ]]; then
      echo "$id: skip $name (use --force to replace)"
    else
      echo "$id: download $url"
      curl --fail --location --retry 3 --retry-all-errors --continue-at - --output "$temporary" "$url"
      mv "$temporary" "$destination"
    fi
    printf '%s  %s\n' "$(sha256 "$destination")" "$name" >> "$checksum_file"
  done < "$url_file"
  echo "$id: checksums written to $checksum_file"
}

if [[ -n "$DATASET" ]]; then
  download_plan "$DATASET"
else
  for plan in "$DATA_DIR"/*/download-urls.txt; do
    [[ -e "$plan" ]] || continue
    download_plan "$(basename "$(dirname "$plan")")"
  done
fi
