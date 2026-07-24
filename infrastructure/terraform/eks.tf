module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.11"

  cluster_name    = "${var.project_name}-cluster"
  cluster_version = var.eks_cluster_version

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  cluster_endpoint_public_access  = true
  cluster_endpoint_private_access = true

  # Addons
  cluster_addons = {
    coredns = { most_recent = true }
    kube-proxy = { most_recent = true }
    vpc-cni = { most_recent = true }
    aws-ebs-csi-driver = { most_recent = true }
  }

  # Node groups
  eks_managed_node_groups = {
    general = {
      desired_size = var.eks_desired_capacity
      min_size     = 2
      max_size     = 6

      instance_types = [var.eks_node_instance_type]
      capacity_type  = "ON_DEMAND"

      labels = {
        role = "general"
      }

      block_device_mappings = {
        xvda = {
          device_name = "/dev/xvda"
          ebs = {
            volume_size = 50
            volume_type = "gp3"
            encrypted   = true
          }
        }
      }
    }
  }

  # IRSA for service accounts
  enable_irsa = true

  tags = {
    Environment = var.environment
  }
}
