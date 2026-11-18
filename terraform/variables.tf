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
