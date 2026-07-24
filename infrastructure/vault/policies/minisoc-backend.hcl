# Backend API can read secrets
path "secret/data/minisoc/*" {
  capabilities = ["read", "list"]
}

# Backend can read database credentials
path "database/creds/minisoc-backend" {
  capabilities = ["read"]
}

# Backend can read PKI certificates
path "pki/issue/minisoc" {
  capabilities = ["create", "update"]
}

# No access to other secrets
path "secret/data/admin/*" {
  capabilities = ["deny"]
}
