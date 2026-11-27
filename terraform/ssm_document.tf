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
      operation = {
        type              = "String"
        default           = "deploy"
        allowedValues     = ["deploy", "rollback"]
        interpolationType = "ENV_VAR"
      }
      releaseId = {
        type              = "String"
        default           = ""
        allowedPattern    = "^([a-f0-9]{40}-[0-9]{8}T[0-9]{6}Z-[a-f0-9]{8})?$"
        interpolationType = "ENV_VAR"
      }
      commitSha = {
        type              = "String"
        default           = ""
        allowedPattern    = "^([a-f0-9]{40})?$"
        interpolationType = "ENV_VAR"
      }
      scriptSha256 = {
        type              = "String"
        allowedPattern    = "^[a-f0-9]{64}$"
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
        default           = ""
        description       = "Frontend image digest (sha256:...)"
        allowedPattern    = "^(sha256:[a-f0-9]{64})?$"
        interpolationType = "ENV_VAR"
      }
      backendDigest = {
        type              = "String"
        default           = ""
        description       = "Backend image digest (sha256:...)"
        allowedPattern    = "^(sha256:[a-f0-9]{64})?$"
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
            "case \"$SSM_operation\" in deploy) dest=/opt/deploy.sh;; rollback) dest=/opt/rollback.sh;; *) exit 1;; esac",
            "mv -f \"$tmp\" \"$dest\"",
            "trap - EXIT",
            "if [ \"$SSM_operation\" = rollback ]; then exec /opt/rollback.sh \"$SSM_releaseId\"; fi",
            "exec /opt/deploy.sh \"$SSM_frontendDigest\" \"$SSM_backendDigest\" \"$SSM_commitSha\""
          ]
          timeoutSeconds   = "600"
          workingDirectory = "/opt"
        }
      }
    ]
  })

  tags = {
    Name = "moss-marrow-deploy"
  }
}
