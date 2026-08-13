#!/bin/bash
# ============================================================
# Mini-SOC - Generate Secrets Script
# ============================================================
# Generates all required secrets for deployment
# Run this once before first deployment
# ============================================================

set -euo pipefail

SECRETS_DIR="./secrets"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}[+] Mini-SOC Secret Generator${NC}"
echo "=================================="

# Create secrets directory
mkdir -p "$SECRETS_DIR"

# Generate secrets
echo -e "${YELLOW}[*] Generating database password...${NC}"
openssl rand -base64 32 > "$SECRETS_DIR/db_password.txt"

echo -e "${YELLOW}[*] Generating JWT secret...${NC}"
openssl rand -base64 64 > "$SECRETS_DIR/jwt_secret.txt"

echo -e "${YELLOW}[*] Generating JWT refresh secret...${NC}"
openssl rand -base64 64 > "$SECRETS_DIR/jwt_refresh_secret.txt"

echo -e "${YELLOW}[*] Creating Wazuh API password secret...${NC}"
echo "Set this file to the password of the Wazuh API user before deployment." >&2
touch "$SECRETS_DIR/wazuh_api_password.txt"

echo -e "${YELLOW}[*] Generating OpenSearch admin password...${NC}"
openssl rand -base64 32 > "$SECRETS_DIR/opensearch_admin_password.txt"

echo -e "${YELLOW}[*] Generating Redis password...${NC}"
openssl rand -base64 32 > "$SECRETS_DIR/redis_password.txt"

echo -e "${YELLOW}[*] Generating n8n encryption key...${NC}"
openssl rand -base64 32 > "$SECRETS_DIR/n8n_encryption_key.txt"

echo -e "${YELLOW}[*] Generating Grafana admin password...${NC}"
openssl rand -base64 24 > "$SECRETS_DIR/grafana_admin_password.txt"

echo -e "${YELLOW}[*] Generating backup encryption passphrase...${NC}"
openssl rand -base64 32 > "$SECRETS_DIR/backup_passphrase.txt"

# Set restrictive permissions
chmod 600 "$SECRETS_DIR"/*.txt
chmod 700 "$SECRETS_DIR"

echo ""
echo -e "${GREEN}[✓] All secrets generated successfully!${NC}"
echo -e "${GREEN}[✓] Secrets stored in: $SECRETS_DIR/${NC}"
echo ""
echo -e "${RED}[!] IMPORTANT: Never commit the secrets/ directory to Git${NC}"
echo -e "${RED}[!] Back up these secrets securely (e.g., password manager)${NC}"
echo ""

# Display summary
echo "Generated files:"
ls -la "$SECRETS_DIR"/*.txt
