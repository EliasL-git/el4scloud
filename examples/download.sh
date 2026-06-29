#!/usr/bin/env bash
# Download a file from el4scloud via the proxy endpoint
# Usage: ./download.sh <file-key> [output-filename]

set -euo pipefail

API_KEY="${EL4S_API_KEY:-}"
BASE_URL="https://cloud.el4s.dev"
FILE_KEY="${1:-}"
OUTPUT="${2:-}"

if [[ -z "$FILE_KEY" ]]; then
  echo "Usage: EL4S_API_KEY=sk_... ./download.sh userId/fileId.jpg [output.jpg]"
  echo ""
  echo "For public files, API key is optional."
  echo "For private files, set EL4S_API_KEY."
  exit 1
fi

AUTH=""
if [[ -n "$API_KEY" ]]; then
  AUTH="-H \"Authorization: Bearer $API_KEY\""
fi

if [[ -z "$OUTPUT" ]]; then
  OUTPUT=$(basename "$FILE_KEY")
fi

echo "Downloading $FILE_KEY to $OUTPUT..."

eval curl -s $AUTH "$BASE_URL/api/proxy/$FILE_KEY" -o "$OUTPUT"
echo "Done: $OUTPUT"
