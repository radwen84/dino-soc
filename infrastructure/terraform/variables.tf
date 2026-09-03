# ==============================================================================
# PROJET ET ENVIRONNEMENT
# ==============================================================================

variable "project_name" {
  description = "Nom du projet utilisé comme préfixe pour toutes les ressources"
  type        = string
  default     = "minisoc"
}

variable "environment" {
  description = "Environnement de déploiement (dev, staging, production)"
  type        = string
  default     = "production"
}

variable "region" {
  description = "Région Huawei Cloud / MESRS Cloud"
  type        = string
  default     = "mesrscloud_tunis"
}

# ==============================================================================
# RESEAU (VPC)
# ==============================================================================

variable "vpc_cidr" {
  description = "Plage CIDR globale pour le VPC"
  type        = string
  default     = "164.160.99.0/24"
}

variable "subnet_nodes_cidr" {
  description = "Plage CIDR pour le sous-réseau des nœuds CCE"
  type        = string
  default     = "164.160.99.0/25"
}

variable "subnet_data_cidr" {
  description = "Plage CIDR pour le sous-réseau des bases de données et du Redis (DCS)"
  type        = string
  default     = "164.160.99.128/25"
}

# ==============================================================================
# COMPUTE (CCE CLUSTER)
# ==============================================================================

variable "cce_node_count" {
  description = "Nombre initial de nœuds de travail Kubernetes dans le pool"
  type        = number
  default     = 2
}

variable "cce_node_flavor" {
  description = "Type d'instance pour les nœuds CCE (ex: s6.xlarge.2 = 4 vCPUs / 8GB RAM)"
  type        = string
  default     = "s6.xlarge.2"
}

variable "cce_node_disk_size" {
  description = "Taille du disque de stockage EVS additionnel en Go pour la rétention des logs"
  type        = number
  default     = 100
}

# ==============================================================================
# CACHE (DCS REDIS)
# ==============================================================================

variable "dcs_redis_capacity" {
  description = "Capacité du cache Redis DCS en Go"
  type        = number
  default     = 2
}