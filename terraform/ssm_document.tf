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
      scriptSha256 = {
        type = "String"
        allowedPattern = "^[a-f0-9]{64}$"
        interpolationType = "ENV_VAR"
      }
      deployScript = {
        type              = "String"
        description       = "Base64-encoded deploy.sh from the verified release"
        allowedPattern    = "^[A-Za-z0-9+/]+={0,2}$"
        maxChars          = 16384
        interpolationType = "ENV_VAR"
      }
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
          runCommand = [
            "set -eu",
            "tmp=$(mktemp /opt/deploy.sh.XXXXXX)",
            "trap 'rm -f \"$tmp\"' EXIT",
            "printf '%s' \"$SSM_deployScript\" | base64 --decode > \"$tmp\"",
            "printf '%s  %s\\n' \"$SSM_scriptSha256\" \"$tmp\" | sha256sum -c -",
            "chmod 0700 \"$tmp\"",
            "mv -f \"$tmp\" /opt/deploy.sh",
            "trap - EXIT",
            "exec /opt/deploy.sh \"$SSM_frontendDigest\" \"$SSM_backendDigest\""
          ]
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
