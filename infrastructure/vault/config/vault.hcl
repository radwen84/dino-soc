storage "file" {
  path = "/vault/file"
}

listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_disable = 0
  tls_cert_file = "/vault/tls/vault-cert.pem"
  tls_key_file  = "/vault/tls/vault-key.pem"
}

# Listener HTTP dev (optionnel)
listener "tcp" {
  address     = "0.0.0.0:8201"
  tls_disable = 1
}

api_addr = "https://vault:8200"
cluster_addr = "https://vault:8201"
ui = true

# Désactivé pour la compatibilité avec les conteneurs Docker / VM
disable_mlock = true

# Telemetry pour Prometheus
telemetry {
  prometheus_retention_time = "30s"
  disable_hostname          = true
}