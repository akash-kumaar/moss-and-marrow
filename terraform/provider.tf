provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "MOSS-MARROW"
      Environment = "Infrastructure"
      ManagedBy   = "Terraform"
    }
  }
}
