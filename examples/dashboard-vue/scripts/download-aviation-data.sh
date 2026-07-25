#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
URL_FILE="$PROJECT_DIR/data/download-urls.txt"
RAW_DIR="$PROJECT_DIR/data/raw"
FORCE=0

while (($#)); do
  case "$1" in
    --force) FORCE=1; shift ;;
    --help) echo 'Usage: bash scripts/download-aviation-data.sh [--force]'; echo 'curl inherits HTTP_PROXY, HTTPS_PROXY, ALL_PROXY and NO_PROXY.'; exit 0 ;;
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

[[ -f "$URL_FILE" ]] || { echo 'Run data:plan first.' >&2; exit 1; }
mkdir -p "$RAW_DIR"
: > "$PROJECT_DIR/data/checksums.sha256"
while IFS= read -r url || [[ -n "$url" ]]; do
  [[ -z "$url" ]] && continue
  name="${url##*/}"
  destination="$RAW_DIR/$name"
  temporary="$destination.part"
  if [[ -f "$destination" && "$FORCE" -eq 0 ]]; then
    echo "skip $name (use --force to replace)"
  else
    echo "download $url"
    if [[ -s "$temporary" ]]; then
      if ! curl --fail --location --retry 3 --retry-all-errors --continue-at - --output "$temporary" "$url"; then
        echo "server does not support resume; restarting $name"
        rm -f "$temporary"
        curl --fail --location --retry 3 --retry-all-errors --output "$temporary" "$url"
      fi
    else
      curl --fail --location --retry 3 --retry-all-errors --output "$temporary" "$url"
    fi
    mv "$temporary" "$destination"
  fi
  printf '%s  %s\n' "$(sha256 "$destination")" "$name" >> "$PROJECT_DIR/data/checksums.sha256"
done < "$URL_FILE"
echo "Checksums: $PROJECT_DIR/data/checksums.sha256"
