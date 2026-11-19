# =============================================================================
# MOSS & MARROW — Terraform Variables
# =============================================================================

variable "aws_region" {
  description = "AWS region for MOSS & MARROW infrastructure"
  type        = string
  default     = "ap-south-1"
}

variable "state_bucket_name" {
  description = "Globally unique S3 bucket for Terraform state"
  type        = string
  default     = "moss-marrow-terraform-state-874940900689-ap-south-1"

  validation {
    condition = can(regex(
      "^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$",
      var.state_bucket_name
    ))

    error_message = "The S3 bucket name must be 3-63 characters and use lowercase letters, numbers, dots, or hyphens."
  }
}

variable "environment" {
  description = "Deployment environment name (e.g. production, staging, dev)"
  type        = string
  default     = "production"
}

# -----------------------------------------------------------------------------
# Networking (VPC) Variables
# -----------------------------------------------------------------------------
variable "vpc_cidr" {
  description = "CIDR block for the MOSS & MARROW VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "enable_nat_gateway" {
  description = "Whether to provision a NAT Gateway for private subnets (costs ~$32/mo)"
  type        = bool
  default     = false
}

variable "single_nat_gateway" {
  description = "Share a single NAT Gateway across all private subnets for cost savings in development"
  type        = bool
  default     = true
}

# -----------------------------------------------------------------------------
# EC2 Instance Variables
# -----------------------------------------------------------------------------
variable "ec2_instance_type" {
  description = "EC2 instance type for running Docker Compose workloads"
  type        = string
  default     = "t3.small"
}

variable "ec2_volume_size" {
  description = "Root EBS volume size in GB for the EC2 instance"
  type        = number
  default     = 20
}
