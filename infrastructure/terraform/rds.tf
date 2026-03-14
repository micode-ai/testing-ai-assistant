# ---------------------------------------------------------------------------
# RDS PostgreSQL – one instance per micro-service
# ---------------------------------------------------------------------------

resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-${var.environment}-db-subnet"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name = "${var.project_name}-${var.environment}-db-subnet"
  }
}

resource "aws_security_group" "rds" {
  name_prefix = "${var.project_name}-${var.environment}-rds-"
  description = "Security group for RDS PostgreSQL instances"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL from EKS nodes"
    from_port       = 5432
    to_port         = 5432
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
    Name = "${var.project_name}-${var.environment}-rds-sg"
  }
}

resource "aws_kms_key" "rds" {
  description             = "KMS key for RDS encryption – ${var.project_name}-${var.environment}"
  deletion_window_in_days = 14
  enable_key_rotation     = true

  tags = {
    Name = "${var.project_name}-${var.environment}-rds-kms"
  }
}

resource "aws_kms_alias" "rds" {
  name          = "alias/${var.project_name}-${var.environment}-rds"
  target_key_id = aws_kms_key.rds.key_id
}

# Parameter group shared across service databases
resource "aws_db_parameter_group" "postgres16" {
  name_prefix = "${var.project_name}-${var.environment}-pg16-"
  family      = "postgres16"
  description = "Custom parameter group for PostgreSQL 16"

  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }

  parameter {
    name  = "shared_preload_libraries"
    value = "pg_stat_statements"
  }

  parameter {
    name         = "pg_stat_statements.track"
    value        = "all"
    apply_method = "pending-reboot"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Generate random passwords for each service DB
resource "random_password" "rds" {
  for_each = toset(local.db_services)

  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}|:,.<>?"
}

# One RDS instance per service
resource "aws_db_instance" "service" {
  for_each = toset(local.db_services)

  identifier = "${var.project_name}-${var.environment}-${each.key}"

  engine         = "postgres"
  engine_version = "16.2"
  instance_class = var.rds_instance_class

  allocated_storage     = 20
  max_allocated_storage = var.environment == "production" ? 200 : 50
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id            = aws_kms_key.rds.arn

  db_name  = replace("${each.key}_db", "-", "_")
  username = "${each.key}_admin"
  password = random_password.rds[each.key].result

  multi_az               = var.environment == "production"
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  parameter_group_name   = aws_db_parameter_group.postgres16.name

  # Backups
  backup_retention_period = var.environment == "production" ? 30 : 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "sun:04:30-sun:05:30"

  # Monitoring
  performance_insights_enabled    = true
  performance_insights_kms_key_id = aws_kms_key.rds.arn
  monitoring_interval             = var.environment == "production" ? 15 : 60
  monitoring_role_arn             = aws_iam_role.rds_monitoring.arn

  # Protection
  deletion_protection = var.environment == "production"
  skip_final_snapshot = var.environment != "production"
  final_snapshot_identifier = var.environment == "production" ? "${var.project_name}-${var.environment}-${each.key}-final" : null

  auto_minor_version_upgrade = true

  tags = {
    Name    = "${var.project_name}-${var.environment}-${each.key}"
    Service = each.key
  }
}

# IAM role for enhanced monitoring
resource "aws_iam_role" "rds_monitoring" {
  name = "${var.project_name}-${var.environment}-rds-monitoring"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "monitoring.rds.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
  role       = aws_iam_role.rds_monitoring.name
}

# Store credentials in AWS Secrets Manager
resource "aws_secretsmanager_secret" "rds" {
  for_each = toset(local.db_services)

  name        = "${var.project_name}/${var.environment}/rds/${each.key}"
  description = "RDS credentials for ${each.key} service"
  kms_key_id  = aws_kms_key.rds.arn

  tags = {
    Service = each.key
  }
}

resource "aws_secretsmanager_secret_version" "rds" {
  for_each = toset(local.db_services)

  secret_id = aws_secretsmanager_secret.rds[each.key].id
  secret_string = jsonencode({
    host     = aws_db_instance.service[each.key].address
    port     = aws_db_instance.service[each.key].port
    dbname   = aws_db_instance.service[each.key].db_name
    username = aws_db_instance.service[each.key].username
    password = random_password.rds[each.key].result
  })
}
