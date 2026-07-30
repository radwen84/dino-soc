#!/bin/bash
set -euo pipefail

# Si Vault est en HTTP dev sur 8200 :
# VAULT_ADDR="${VAULT_ADDR:-http://localhost:8200}"

# Si Vault est en HTTPS comme dans ton vault.hcl :
VAULT_ADDR="${VAULT_ADDR:-https://localhost:8200}"
export VAULT_ADDR

# Si certificat self-signed en local, active temporairement ceci :
export VAULT_SKIP_VERIFY="${VAULT_SKIP_VERIFY:-true}"

echo "=== MiniSOC Vault Initialization ==="

mkdir -p /vault/file /vault/logs

# Check if already initialized
if vault status 2>/dev/null | grep -q "Initialized.*true"; then
  echo "Vault already initialized."
else
  echo "[1/6] Initializing Vault..."
  vault operator init -key-shares=5 -key-threshold=3 \
    -format=json > /vault/file/init-keys.json

  echo "IMPORTANT: Store init-keys.json securely and delete from this location!"
fi

# Unseal
echo "[2/6] Unsealing Vault..."
UNSEAL_KEYS=$(jq -r '.unseal_keys_b64[0:3][]' /vault/file/init-keys.json)

for key in $UNSEAL_KEYS; do
  vault operator unseal "$key" || true
done

# Login with root token
ROOT_TOKEN=$(jq -r '.root_token' /vault/file/init-keys.json)
vault login "$ROOT_TOKEN"

# Enable KV v2 secrets engine
echo "[3/6] Enabling secrets engines..."
vault secrets enable -path=secret -version=2 kv 2>/dev/null || true
vault secrets enable database 2>/dev/null || true
vault secrets enable pki 2>/dev/null || true

# Enable audit
echo "[4/6] Enabling audit logging..."
vault audit enable file file_path=/vault/logs/audit.log 2>/dev/null || true

# Create policies
echo "[5/6] Creating policies..."
vault policy write minisoc-backend /vault/policies/minisoc-backend.hcl
vault policy write minisoc-admin /vault/policies/minisoc-admin.hcl

# Store initial secrets
echo "[6/6] Storing initial secrets..."
vault kv put secret/minisoc/database \
  url="postgresql://minisoc:CHANGE_ME@postgres:5432/minisoc" \
  username="minisoc" \
  password="CHANGE_ME"

vault kv put secret/minisoc/jwt \
  secret="CHANGE_ME_MIN_32_CHARS_LONG_SECRET_KEY" \
  expires_in="15m" \
  refresh_expires_in="7d"

vault kv put secret/minisoc/redis \
  url="redis://:CHANGE_ME@redis:6379" \
  password="CHANGE_ME"

vault kv put secret/minisoc/threat-intel \
  otx_api_key="CHANGE_ME" \
  abuseipdb_api_key="CHANGE_ME" \
  misp_url="https://misp.local" \
  misp_api_key="CHANGE_ME"

vault kv put secret/minisoc/opensearch \
  url="https://opensearch:9200" \
  username="admin" \
  password="CHANGE_ME"

# Create AppRole for backend
echo "Creating AppRole for backend..."
vault auth enable approle 2>/dev/null || true

vault write auth/approle/role/minisoc-backend \
  token_policies="minisoc-backend" \
  token_ttl=1h \
  token_max_ttl=4h \
  secret_id_ttl=24h

echo ""
echo "Vault initialization complete!"
echo "Backend Role ID: $(vault read -field=role_id auth/approle/role/minisoc-backend/role-id)"
echo ""
echo "Next steps:"
echo "  1. Store /vault/file/init-keys.json in a secure offline location"
echo "  2. Replace all CHANGE_ME values with real credentials"
echo "  3. Generate a Secret ID for the backend AppRole"
echo "  4. Configure the backend to use Vault for secrets"