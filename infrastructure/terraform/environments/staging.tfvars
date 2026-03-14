environment  = "staging"
region       = "us-east-1"
project_name = "testing-ai"

# EKS – mirrors production topology at smaller scale
eks_cluster_version     = "1.29"
eks_node_instance_types = ["t3.large"]
eks_node_min_size       = 2
eks_node_max_size       = 6
eks_node_desired_size   = 3

# RDS
rds_instance_class = "db.t3.medium"

# ElastiCache
redis_node_type = "cache.t3.medium"

# DNS
domain_name = "staging.testing-ai.example.com"
