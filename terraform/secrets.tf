# =============================================================================
# MOSS & MARROW — Secrets Manager
# =============================================================================
# Placeholder Secrets Manager secrets for application runtime credentials.
# Values are NOT managed in Terraform and must be set via AWS CLI or Console.
# =============================================================================

resource "aws_secretsmanager_secret" "mongodb_uri" {
  name                    = "moss-marrow/MONGODB_URI"
  description             = "MongoDB connection URI for MOSS & MARROW backend"
  recovery_window_in_days = 7

  tags = {
    Component = "Backend"
  }
}

resource "aws_secretsmanager_secret" "jwt_secret" {
  name                    = "moss-marrow/JWT_ACCESS_SECRET"
  description             = "JWT signing secret for MOSS & MARROW backend"
  recovery_window_in_days = 7

  tags = {
    Component = "Backend"
  }
}
