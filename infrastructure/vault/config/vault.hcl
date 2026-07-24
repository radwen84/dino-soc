storage "file" {
  path = "/vault/file"
}

listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_disable = 0
  tls_cert_file = "/vault/tls/vault-cert.pem"
  tls_key_file  = "/vault/tls/vault-key.pem"
}

# Disable TLS for dev (override in production)
listener "tcp" {
  address     = "0.0.0.0:8201"
  tls_disable = 1
}

api_addr = "https://vault:8200"
cluster_addr = "https://vault:8201"

ui = true
disable_mlock = false

# Audit logging
audit {
  type = "file"
  path = "file"
  options = {
    file_path = "/vault/logs/audit.log"
  }
}

# Telemetry for Prometheus
telemetry {
  prometheus_retention_time = "30s"
  disable_hostname = true
}
