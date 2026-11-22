# =============================================================================
# MOSS & MARROW — AWS Systems Manager Run Command Document
# =============================================================================
# Securely deploys frontend and backend containers via Docker Compose on EC2.
# Parameters are passed using ENV_VAR interpolation to prevent shell injection.
# =============================================================================

resource "aws_ssm_document" "deploy" {
  name            = "moss-marrow-deploy"
  document_type   = "Command"
  document_format = "YAML"

  content = yamlencode({
    schemaVersion = "2.2"
    description   = "Deploy MOSS & MARROW containers via Docker Compose"
    parameters = {
      frontendDigest = {
        type              = "String"
        description       = "Frontend image digest (sha256:...)"
        allowedPattern    = "^sha256:[a-f0-9]{64}$"
        interpolationType = "ENV_VAR"
      }
      backendDigest = {
        type              = "String"
        description       = "Backend image digest (sha256:...)"
        allowedPattern    = "^sha256:[a-f0-9]{64}$"
        interpolationType = "ENV_VAR"
      }
    }
    mainSteps = [
      {
        action = "aws:runShellScript"
        name   = "deploy"
        inputs = {
          runCommand       = ["/opt/deploy.sh"]
          timeoutSeconds   = "300"
          workingDirectory = "/opt"
        }
      }
    ]
  })

  tags = {
    Name = "moss-marrow-deploy"
  }
}
