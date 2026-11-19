# =============================================================================
# MOSS & MARROW — Terraform Outputs
# =============================================================================

output "frontend_ecr_repository_url" {
  description = "Frontend Amazon ECR repository URL"
  value       = aws_ecr_repository.frontend.repository_url
}

output "backend_ecr_repository_url" {
  description = "Backend Amazon ECR repository URL"
  value       = aws_ecr_repository.backend.repository_url
}

output "vpc_id" {
  description = "ID of the MOSS & MARROW VPC"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = aws_subnet.private[*].id
}

output "ec2_instance_id" {
  description = "ID of the MOSS & MARROW EC2 instance"
  value       = aws_instance.app.id
}

output "ec2_public_ip" {
  description = "Public IPv4 address of the EC2 instance"
  value       = aws_instance.app.public_ip
}

output "github_ecr_role_arn" {
  description = "IAM role assumed by GitHub Actions for ECR publishing"
  value       = aws_iam_role.github_ecr_publisher.arn
}

output "github_deploy_role_arn" {
  description = "IAM role assumed by GitHub Actions for EC2 deployment via SSM"
  value       = aws_iam_role.github_ec2_deployer.arn
}

output "ssm_document_name" {
  description = "Name of the SSM Document used for deployment"
  value       = aws_ssm_document.deploy.name
}

output "mongodb_secret_arn" {
  description = "ARN of the Secrets Manager secret for MONGODB_URI"
  value       = aws_secretsmanager_secret.mongodb_uri.arn
}

output "jwt_secret_arn" {
  description = "ARN of the Secrets Manager secret for JWT_ACCESS_SECRET"
  value       = aws_secretsmanager_secret.jwt_secret.arn
}
