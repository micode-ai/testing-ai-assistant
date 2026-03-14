# -----------------------------------------------------------------------------
# General
# -----------------------------------------------------------------------------
variable "region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment (dev, staging, production)"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "environment must be one of: dev, staging, production"
  }
}

variable "project_name" {
  description = "Project identifier used for resource naming"
  type        = string
  default     = "testing-ai"
}

# -----------------------------------------------------------------------------
# EKS
# -----------------------------------------------------------------------------
variable "eks_cluster_version" {
  description = "Kubernetes version for the EKS cluster"
  type        = string
  default     = "1.29"
}

variable "eks_node_instance_types" {
  description = "EC2 instance types for the general-purpose managed node group"
  type        = list(string)
  default     = ["t3.large"]
}

variable "eks_node_min_size" {
  description = "Minimum number of nodes in the general-purpose node group"
  type        = number
  default     = 2
}

variable "eks_node_max_size" {
  description = "Maximum number of nodes in the general-purpose node group"
  type        = number
  default     = 10
}

variable "eks_node_desired_size" {
  description = "Desired number of nodes in the general-purpose node group"
  type        = number
  default     = 3
}

# -----------------------------------------------------------------------------
# RDS
# -----------------------------------------------------------------------------
variable "rds_instance_class" {
  description = "RDS instance class for PostgreSQL databases"
  type        = string
  default     = "db.t3.medium"
}

# -----------------------------------------------------------------------------
# ElastiCache
# -----------------------------------------------------------------------------
variable "redis_node_type" {
  description = "ElastiCache node type for Redis"
  type        = string
  default     = "cache.t3.medium"
}

# -----------------------------------------------------------------------------
# DNS / TLS
# -----------------------------------------------------------------------------
variable "domain_name" {
  description = "Root domain name for the platform (e.g. testing-ai.example.com)"
  type        = string
  default     = ""
}
