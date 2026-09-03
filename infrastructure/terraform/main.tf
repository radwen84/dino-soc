terraform {
  required_version = ">= 1.3.0"
  required_providers {
    huaweicloud = {
      source  = "huaweicloud/huaweicloud"
      version = ">= 1.60.0"
    }
    random = {
      source  = "hashicorp/random"
      version = ">= 3.0.0"
    }
  }
}

provider "huaweicloud" {
  region = "mesrscloud_tunis" # À adapter selon la région exacte MESRS
}

# ==============================================================================
# 1. RESEAU (VPC & SUBNETS)
# ==============================================================================

resource "huaweicloud_vpc" "soc_vpc" {
  name = "${var.project_name}-vpc"
  cidr = "164.160.99.0/24"
}

# Subnet pour les composants Compute (CCE / SIEM)
resource "huaweicloud_vpc_subnet" "subnet_nodes" {
  name          = "${var.project_name}-subnet-nodes"
  cidr          = "164.160.99.0/25"
  gateway_ip    = "164.160.99.1"
  vpc_id        = huaweicloud_vpc.soc_vpc.id
  primary_dns   = "10.200.5.10"
  secondary_dns = "10.200.5.12"
}

# Subnet pour les bases de données et Cache (DCS Redis)
resource "huaweicloud_vpc_subnet" "subnet_data" {
  name          = "${var.project_name}-subnet-data"
  cidr          = "164.160.99.128/25"
  gateway_ip    = "164.160.99.129"
  vpc_id        = huaweicloud_vpc.soc_vpc.id
  primary_dns   = "10.200.5.10"
  secondary_dns = "10.200.5.12"
}

# ==============================================================================
# 2. GROUPES DE SECURITE
# ==============================================================================

resource "huaweicloud_networking_secgroup" "sg_redis" {
  name        = "${var.project_name}-sg-redis"
  description = "Regles de securite pour le cache Redis Mini-SOC"
}

# Autoriser le port Redis (6379) depuis le sous-réseau des nœuds SOC
resource "huaweicloud_networking_secgroup_rule" "rule_redis_ingress" {
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 6379
  port_range_max    = 6379
  remote_ip_prefix  = huaweicloud_vpc_subnet.subnet_nodes.cidr
  security_group_id = huaweicloud_networking_secgroup.sg_redis.id
}

# ==============================================================================
# 3. CACHE DISTRIBUÉ REDIS (DCS)
# ==============================================================================

resource "random_password" "redis_password" {
  length           = 24
  special          = true
  override_special = "!@#$%"
}

resource "huaweicloud_dcs_instance" "redis" {
  name           = "${var.project_name}-redis"
  engine         = "Redis"
  engine_version = "6.0"
  capacity       = 2 # Capacité en GB (ex: 2GB)
  node_type      = "ha" # High Availability (Master/Standby) pour la prod ou "single" pour dev

  vpc_id            = huaweicloud_vpc.soc_vpc.id
  subnet_id         = huaweicloud_vpc_subnet.subnet_data.id
  security_group_id = huaweicloud_networking_secgroup.sg_redis.id
  password          = random_password.redis_password.result

  backup_policy {
    backup_type = "auto"
    begin_at    = "00:00-01:00"
    period_type = "weekly"
    backup_at   = [1, 3, 5, 7]
  }
}

# ==============================================================================
# 4. KUBERNETES ENGINE (CCE Cluster & Node Pool)
# ==============================================================================

# Cluster Kubernetes CCE
resource "huaweicloud_cce_cluster" "soc_cluster" {
  name                   = "${var.project_name}-cluster"
  flavor_id              = "cce.s1.small" # Type de control plane CCE
  vpc_id                 = huaweicloud_vpc.soc_vpc.id
  subnet_id              = huaweicloud_vpc_subnet.subnet_nodes.id
  container_network_type = "overlay_l2"
}

# Nœuds de travail (Node Pool CCE)
resource "huaweicloud_cce_node_pool" "node_pool" {
  cluster_id         = huaweicloud_cce_cluster.soc_cluster.id
  name               = "${var.project_name}-nodepool"
  os                 = "EulerOS 2.9" # OS standard optimisé Huawei Cloud
  initial_node_count = 2
  flavor_id          = "s6.xlarge.2" # 4 vCPUs / 8 GB RAM per worker node

  root_volume {
    size       = 50
    volumetype = "SSD"
  }

  # Disque EVS additionnel pour stocker les logs / data de manière persistante
  data_volumes {
    size       = 100
    volumetype = "SSD"
  }

  scrip_postinstall = <<EOF
#!/bin/bash
echo "Cluster Node configuré pour le Mini-SOC"
EOF
}

# ==============================================================================
# 5. ELASTIC IP (EIP) & NAT GATEWAY (Accès réseau sécurisé)
# ==============================================================================

resource "huaweicloud_vpc_eip" "eip_soc" {
  publicip {
    type = "5_bgp"
  }
  bandwidth {
    name        = "${var.project_name}-bandwidth"
    size        = 10 # 10 Mbps
    share_type  = "PER"
    charge_mode = "traffic"
  }
}

resource "huaweicloud_nat_gateway" "nat_soc" {
  name      = "${var.project_name}-nat"
  spec      = "1" # Small
  vpc_id    = huaweicloud_vpc.soc_vpc.id
  subnet_id = huaweicloud_vpc_subnet.subnet_nodes.id
}

resource "huaweicloud_nat_snat_rule" "snat_nodes" {
  nat_gateway_id = huaweicloud_nat_gateway.nat_soc.id
  floating_ip_id = huaweicloud_vpc_eip.eip_soc.id
  subnet_id      = huaweicloud_vpc_subnet.subnet_nodes.id
}