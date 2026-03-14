environment  = "production"
region       = "us-east-1"
project_name = "testing-ai"

# EKS – production-grade sizing
eks_cluster_version     = "1.29"
eks_node_instance_types = ["m6i.xlarge", "m6a.xlarge"]
eks_node_min_size       = 3
eks_node_max_size       = 20
eks_node_desired_size   = 5

# RDS – multi-AZ enabled automatically for production in rds.tf
rds_instance_class = "db.r6g.large"

# ElastiCache
redis_node_type = "cache.r6g.large"

# DNS
domain_name = "testing-ai.example.com"
