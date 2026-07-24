#!/bin/bash
set -euo pipefail

# Configuration
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-minisoc}"
DB_USER="${DB_USER:-minisoc}"
BACKUP_DIR="/backups/postgres"
S3_BUCKET="${S3_BUCKET:-minisoc-backups}"
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"

echo "=== PostgreSQL Backup - $(date) ==="
echo "Database: ${DB_NAME}@${DB_HOST}:${DB_PORT}"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Perform backup
echo "[1/4] Creating backup..."
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  --format=plain --no-owner --no-privileges \
  | gzip > "$BACKUP_FILE"

BACKUP_SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
echo "  → Backup created: $BACKUP_FILE ($BACKUP_SIZE)"

# Verify backup
echo "[2/4] Verifying backup..."
gunzip -t "$BACKUP_FILE"
echo "  → Backup integrity verified"

# Upload to S3
echo "[3/4] Uploading to S3..."
if command -v aws &> /dev/null; then
  aws s3 cp "$BACKUP_FILE" "s3://${S3_BUCKET}/postgres/${DB_NAME}_${TIMESTAMP}.sql.gz" \
    --storage-class STANDARD_IA
  echo "  → Uploaded to s3://${S3_BUCKET}/postgres/"
else
  echo "  ⚠️  AWS CLI not available, skipping S3 upload"
fi

# Cleanup old backups
echo "[4/4] Cleaning old backups (>${RETENTION_DAYS} days)..."
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete
REMAINING=$(ls "$BACKUP_DIR"/*.sql.gz 2>/dev/null | wc -l)
echo "  → $REMAINING backup(s) retained"

echo ""
echo "✅ Backup complete: $BACKUP_FILE"