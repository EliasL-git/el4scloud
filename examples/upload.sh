#!/usr/bin/env bash
# Upload a file to el4scloud using the REST API
# Usage: ./upload.sh <file> [isPublic]

set -euo pipefail

API_KEY="${EL4S_API_KEY:-}"
BASE_URL="https://cloud.el4s.dev"
FILE="${1:-}"
IS_PUBLIC="${2:-false}"

if [[ -z "$API_KEY" ]]; then
  echo "Error: Set EL4S_API_KEY environment variable or pass API key"
  echo "Usage: EL4S_API_KEY=sk_... ./upload.sh photo.jpg true"
  exit 1
fi

if [[ -z "$FILE" || ! -f "$FILE" ]]; then
  echo "Error: File not found: $FILE"
  echo "Usage: EL4S_API_KEY=sk_... ./upload.sh photo.jpg true"
  exit 1
fi

echo "Uploading $FILE..."

curl -s -X POST "$BASE_URL/api/upload" \
  -H "Authorization: Bearer $API_KEY" \
  -F "file=@$FILE" \
  -F "isPublic=$IS_PUBLIC" | python3 -m json.tool 2>/dev/null || cat
