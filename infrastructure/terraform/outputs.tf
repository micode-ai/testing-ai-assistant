# -----------------------------------------------------------------------------
# EKS
# -----------------------------------------------------------------------------
output "eks_cluster_endpoint" {
  description = "Endpoint URL for the EKS cluster API server"
  value       = module.eks.cluster_endpoint
}

output "eks_cluster_name" {
  description = "Name of the EKS cluster"
  value       = module.eks.cluster_name
}

output "eks_cluster_certificate_authority" {
  description = "Base64-encoded CA certificate for the cluster"
  value       = module.eks.cluster_certificate_authority_data
  sensitive   = true
}

output "eks_oidc_provider_arn" {
  description = "ARN of the OIDC provider for IRSA"
  value       = module.eks.oidc_provider_arn
}

# -----------------------------------------------------------------------------
# RDS
# -----------------------------------------------------------------------------
output "rds_endpoints" {
  description = "Map of service name to RDS writer endpoint"
  value = {
    for svc, mod in module.rds : svc => mod.endpoint
  }
}

output "rds_port" {
  description = "PostgreSQL port (same for all instances)"
  value       = 5432
}

# -----------------------------------------------------------------------------
# ElastiCache / Redis
# -----------------------------------------------------------------------------
output "redis_endpoint" {
  description = "Primary endpoint for the Redis replication group"
  value       = module.elasticache.primary_endpoint
}

output "redis_reader_endpoint" {
  description = "Reader endpoint for the Redis replication group"
  value       = module.elasticache.reader_endpoint
}

output "redis_port" {
  description = "Redis port"
  value       = 6379
}

# -----------------------------------------------------------------------------
# S3
# -----------------------------------------------------------------------------
output "s3_bucket_name" {
  description = "Name of the S3 artifacts bucket"
  value       = module.s3.bucket_name
}

output "s3_bucket_arn" {
  description = "ARN of the S3 artifacts bucket"
  value       = module.s3.bucket_arn
}

# -----------------------------------------------------------------------------
# VPC
# -----------------------------------------------------------------------------
output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc_id
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = module.vpc.private_subnet_ids
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = module.vpc.public_subnet_ids
}
