#!/bin/bash
set -euo pipefail

OPENSEARCH_URL="${OPENSEARCH_URL:-https://opensearch:9200}"
SNAPSHOT_REPO="minisoc-backups"
SNAPSHOT_NAME="snapshot_$(date +%Y%m%d_%H%M%S)"

echo "=== OpenSearch Backup - $(date) ==="

# Register S3 repository (first time only)
curl -sk -X PUT "${OPENSEARCH_URL}/_snapshot/${SNAPSHOT_REPO}" \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "s3",
    "settings": {
      "bucket": "minisoc-backups",
      "base_path": "opensearch",
      "region": "eu-west-3"
    }
  }' 2>/dev/null || true

# Create snapshot
echo "Creating snapshot: ${SNAPSHOT_NAME}..."
curl -sk -X PUT "${OPENSEARCH_URL}/_snapshot/${SNAPSHOT_REPO}/${SNAPSHOT_NAME}?wait_for_completion=true" \
  -H 'Content-Type: application/json' \
  -d '{
    "indices": "minisoc-*,wazuh-alerts-*",
    "ignore_unavailable": true,
    "include_global_state": false
  }'

echo ""
echo "✅ Snapshot created: ${SNAPSHOT_NAME}"

# Cleanup old snapshots (keep last 7)
echo "Cleaning old snapshots..."
SNAPSHOTS=$(curl -sk "${OPENSEARCH_URL}/_snapshot/${SNAPSHOT_REPO}/_all" | jq -r '.snapshots[:-7][].snapshot')
for snap in $SNAPSHOTS; do
  curl -sk -X DELETE "${OPENSEARCH_URL}/_snapshot/${SNAPSHOT_REPO}/${snap}"
  echo "  Deleted: $snap"
done
