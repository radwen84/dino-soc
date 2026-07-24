#!/bin/bash
# ============================================================
# Mini-SOC - Generate TLS Certificates (Development)
# ============================================================
# Generates self-signed certificates for local development
# For production, use Let's Encrypt or a proper CA
# ============================================================

set -euo pipefail

SSL_DIR="./infrastructure/nginx/ssl"
DOMAIN="soc.local"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}[+] Mini-SOC TLS Certificate Generator${NC}"
echo "=========================================="

mkdir -p "$SSL_DIR"

echo -e "${YELLOW}[*] Generating CA private key...${NC}"
openssl genrsa -out "$SSL_DIR/ca.key" 4096

echo -e "${YELLOW}[*] Generating CA certificate...${NC}"
openssl req -x509 -new -nodes \
  -key "$SSL_DIR/ca.key" \
  -sha256 -days 1825 \
  -out "$SSL_DIR/ca.crt" \
  -subj "/C=FR/ST=IDF/L=Paris/O=MiniSOC/OU=Security/CN=MiniSOC Root CA"

echo -e "${YELLOW}[*] Generating server private key...${NC}"
openssl genrsa -out "$SSL_DIR/privkey.pem" 2048

echo -e "${YELLOW}[*] Generating certificate signing request...${NC}"
openssl req -new \
  -key "$SSL_DIR/privkey.pem" \
  -out "$SSL_DIR/server.csr" \
  -subj "/C=FR/ST=IDF/L=Paris/O=MiniSOC/OU=Security/CN=${DOMAIN}"

echo -e "${YELLOW}[*] Creating extensions file...${NC}"
cat > "$SSL_DIR/cert-ext.cnf" << EOF
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = ${DOMAIN}
DNS.2 = *.${DOMAIN}
DNS.3 = localhost
IP.1 = 127.0.0.1
IP.2 = 10.0.0.1
EOF

echo -e "${YELLOW}[*] Signing certificate with CA...${NC}"
openssl x509 -req \
  -in "$SSL_DIR/server.csr" \
  -CA "$SSL_DIR/ca.crt" \
  -CAkey "$SSL_DIR/ca.key" \
  -CAcreateserial \
  -out "$SSL_DIR/fullchain.pem" \
  -days 365 \
  -sha256 \
  -extfile "$SSL_DIR/cert-ext.cnf"

# Append CA cert to create full chain
cat "$SSL_DIR/ca.crt" >> "$SSL_DIR/fullchain.pem"

# Cleanup temporary files
rm -f "$SSL_DIR/server.csr" "$SSL_DIR/cert-ext.cnf" "$SSL_DIR/ca.srl"

# Set permissions
chmod 600 "$SSL_DIR/privkey.pem" "$SSL_DIR/ca.key"
chmod 644 "$SSL_DIR/fullchain.pem" "$SSL_DIR/ca.crt"

echo ""
echo -e "${GREEN}[✓] TLS certificates generated successfully!${NC}"
echo ""
echo "Files:"
echo "  CA Certificate:     $SSL_DIR/ca.crt"
echo "  Server Certificate: $SSL_DIR/fullchain.pem"
echo "  Server Key:         $SSL_DIR/privkey.pem"
echo ""
echo -e "${YELLOW}[!] For development: Add ca.crt to your browser's trusted CAs${NC}"
echo -e "${YELLOW}[!] For production: Replace with Let's Encrypt certificates${NC}"
