# ---------------------------------------------------------------------------
# ElastiCache Redis 7 Replication Group
# ---------------------------------------------------------------------------

resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.project_name}-${var.environment}-redis-subnet"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name = "${var.project_name}-${var.environment}-redis-subnet"
  }
}

resource "aws_security_group" "redis" {
  name_prefix = "${var.project_name}-${var.environment}-redis-"
  description = "Security group for ElastiCache Redis"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Redis from EKS nodes"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_cluster.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-redis-sg"
  }
}

resource "aws_kms_key" "redis" {
  description             = "KMS key for ElastiCache encryption – ${var.project_name}-${var.environment}"
  deletion_window_in_days = 14
  enable_key_rotation     = true

  tags = {
    Name = "${var.project_name}-${var.environment}-redis-kms"
  }
}

resource "aws_kms_alias" "redis" {
  name          = "alias/${var.project_name}-${var.environment}-redis"
  target_key_id = aws_kms_key.redis.key_id
}

resource "random_password" "redis_auth" {
  length           = 64
  special          = false # ElastiCache auth token only allows printable ASCII minus certain chars
}

resource "aws_elasticache_parameter_group" "redis7" {
  name   = "${var.project_name}-${var.environment}-redis7"
  family = "redis7"

  parameter {
    name  = "maxmemory-policy"
    value = "volatile-lru"
  }

  parameter {
    name  = "notify-keyspace-events"
    value = "Ex"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-redis7-params"
  }
}

resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "${var.project_name}-${var.environment}-redis"
  description          = "Redis cluster for ${var.project_name} ${var.environment}"

  engine               = "redis"
  engine_version       = "7.1"
  node_type            = var.redis_node_type
  port                 = 6379
  parameter_group_name = aws_elasticache_parameter_group.redis7.name

  # Topology
  num_cache_clusters   = var.environment == "production" ? 3 : 2
  automatic_failover_enabled = true
  multi_az_enabled           = var.environment == "production"

  # Networking
  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  # Encryption
  at_rest_encryption_enabled = true
  kms_key_id                 = aws_kms_key.redis.arn
  transit_encryption_enabled = true
  auth_token                 = random_password.redis_auth.result

  # Maintenance
  maintenance_window       = "sun:05:00-sun:06:00"
  snapshot_window          = "03:00-04:00"
  snapshot_retention_limit = var.environment == "production" ? 7 : 1
  auto_minor_version_upgrade = true

  # Notifications
  apply_immediately = var.environment != "production"

  tags = {
    Name = "${var.project_name}-${var.environment}-redis"
  }
}

# Store the auth token in Secrets Manager
resource "aws_secretsmanager_secret" "redis" {
  name        = "${var.project_name}/${var.environment}/redis"
  description = "ElastiCache Redis auth token"
  kms_key_id  = aws_kms_key.redis.arn
}

resource "aws_secretsmanager_secret_version" "redis" {
  secret_id = aws_secretsmanager_secret.redis.id
  secret_string = jsonencode({
    primary_endpoint = aws_elasticache_replication_group.main.primary_endpoint_address
    reader_endpoint  = aws_elasticache_replication_group.main.reader_endpoint_address
    port             = 6379
    auth_token       = random_password.redis_auth.result
  })
}
