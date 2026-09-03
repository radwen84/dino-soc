# ==============================================================================
# IDENTIFIANTS RESEAU
# ==============================================================================

output "vpc_id" {
  description = "ID du VPC Mini-SOC"
  value       = huaweicloud_vpc.soc_vpc.id
}

output "nat_gateway_ip" {
  description = "Adresse IP publique de la NAT Gateway (EIP)"
  value       = huaweicloud_vpc_eip.eip_soc.publicip[0].address
}

# ==============================================================================
# KUBERNETES (CCE CLUSTER)
# ==============================================================================

output "cce_cluster_id" {
  description = "ID du cluster Kubernetes CCE"
  value       = huaweicloud_cce_cluster.soc_cluster.id
}

output "cce_cluster_name" {
  description = "Nom du cluster Kubernetes CCE"
  value       = huaweicloud_cce_cluster.soc_cluster.name
}

# ==============================================================================
# CACHE REDIS (DCS)
# ==============================================================================

output "redis_endpoint" {
  description = "Point d'accès privé (IP/FQDN) de la base Redis DCS"
  value       = huaweicloud_dcs_instance.redis.ip
}

output "redis_port" {
  description = "Port de connexion au service Redis DCS"
  value       = huaweicloud_dcs_instance.redis.port
}

output "redis_password_secret" {
  description = "Mot de passe généré pour le serveur Redis DCS"
  value       = random_password.redis_password.result
  sensitive   = true
}