# Admin has full access to MiniSOC secrets
path "secret/data/minisoc/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

path "secret/metadata/minisoc/*" {
  capabilities = ["list", "read", "delete"]
}

# Admin can manage database roles
path "database/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# Admin can manage PKI
path "pki/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# Admin can view audit logs
path "sys/audit*" {
  capabilities = ["read", "list"]
}
