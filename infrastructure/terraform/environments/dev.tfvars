environment  = "dev"
region       = "us-east-1"
project_name = "testing-ai"

# EKS – smaller footprint for development
eks_cluster_version     = "1.29"
eks_node_instance_types = ["t3.medium"]
eks_node_min_size       = 1
eks_node_max_size       = 4
eks_node_desired_size   = 2

# RDS – smallest viable instance
rds_instance_class = "db.t3.micro"

# ElastiCache
redis_node_type = "cache.t3.micro"

# DNS
domain_name = "dev.testing-ai.example.com"
