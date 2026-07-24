#!/bin/bash
set -euo pipefail

RULES_DIR="$(dirname "$0")/rules"
SCAN_DIR="${1:-/tmp/suspicious}"

echo "=== Mini-SOC YARA Scanner ==="
echo "Rules: $RULES_DIR"
echo "Target: $SCAN_DIR"
echo ""

if ! command -v yara &> /dev/null; then
  echo "Error: yara not installed. Install with: apt-get install yara"
  exit 1
fi

if [ ! -d "$SCAN_DIR" ]; then
  echo "Error: Directory $SCAN_DIR does not exist"
  exit 1
fi

FINDINGS=0

for rule_file in "$RULES_DIR"/*.yar; do
  echo "--- Scanning with: $(basename "$rule_file") ---"
  RESULT=$(yara -r -s "$rule_file" "$SCAN_DIR" 2>/dev/null || true)
  if [ -n "$RESULT" ]; then
    echo "$RESULT"
    FINDINGS=$((FINDINGS + 1))
  fi
done

echo ""
if [ $FINDINGS -gt 0 ]; then
  echo "⚠️  $FINDINGS rule(s) matched! Review findings above."
  exit 1
else
  echo "✅ No matches found. Clean scan."
  exit 0
fi
