# =============================================================================
# MOSS & MARROW — IAM Roles and Policies
# =============================================================================
# Least-privilege IAM configuration for:
#   1. GitHub Actions ECR Publisher (pushes images)
#   2. GitHub Actions EC2 Deployer (invokes SSM Run Command)
#   3. EC2 Instance Profile (pulls ECR images, reads Secrets Manager, managed by SSM)
# =============================================================================

data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

# -----------------------------------------------------------------------------
# GitHub Actions: ECR Publisher Role
# -----------------------------------------------------------------------------
resource "aws_iam_role" "github_ecr_publisher" {
  name = "moss-marrow-github-ecr-publisher"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = data.aws_iam_openid_connect_provider.github.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
            "token.actions.githubusercontent.com:sub" = ":akash-kumaar@217486588/moss-and-marrow@1458106685:ref:refs/heads/main"
          }
        }
      }
    ]
  })

  tags = {
    Component = "GitHub-Actions"
  }
}

resource "aws_iam_role_policy" "github_ecr_push" {
  name = "moss-marrow-ecr-push"
  role = aws_iam_role.github_ecr_publisher.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ECRAuthentication"
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken"]
        Resource = "*"
      },
      {
        Sid    = "PushImages"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:BatchGetImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:GetDownloadUrlForLayer",
          "ecr:PutImage"
        ]
        Resource = [
          aws_ecr_repository.frontend.arn,
          aws_ecr_repository.backend.arn
        ]
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# GitHub Actions: EC2 Deployer Role (SSM Run Command)
# -----------------------------------------------------------------------------
resource "aws_iam_role" "github_ec2_deployer" {
  name = "moss-marrow-github-ec2-deployer"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = data.aws_iam_openid_connect_provider.github.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
            "token.actions.githubusercontent.com:sub" = ":akash-kumaar@217486588/moss-and-marrow@1458106685:ref:refs/heads/main"
          }
        }
      }
    ]
  })

  tags = {
    Component = "GitHub-Actions"
  }
}

resource "aws_iam_role_policy" "github_ec2_deploy" {
  name = "moss-marrow-ec2-deploy-policy"
  role = aws_iam_role.github_ec2_deployer.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ECRAuthentication"
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken"]
        Resource = "*"
      },
      {
        Sid    = "ECRReadImages"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:BatchGetImage",
          "ecr:GetDownloadUrlForLayer",
          "ecr:DescribeImages"
        ]
        Resource = [
          aws_ecr_repository.frontend.arn,
          aws_ecr_repository.backend.arn
        ]
      },
      {
        Sid      = "EC2DescribeInstances"
        Effect   = "Allow"
        Action   = ["ec2:DescribeInstances"]
        Resource = "*"
      },
      {
        Sid    = "SSMSendCommandScoped"
        Effect = "Allow"
        Action = ["ssm:SendCommand"]
        Resource = [
          aws_ssm_document.deploy.arn,
          aws_instance.app.arn
        ]
      },
      {
        Sid      = "SSMGetCommandInvocation"
        Effect   = "Allow"
        Action   = ["ssm:GetCommandInvocation"]
        Resource = "*"
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# EC2 Instance IAM Role and Profile
# -----------------------------------------------------------------------------
resource "aws_iam_role" "ec2_instance" {
  name = "moss-marrow-ec2-instance-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Component = "EC2"
  }
}

resource "aws_iam_instance_profile" "ec2" {
  name = "moss-marrow-ec2-instance-profile"
  role = aws_iam_role.ec2_instance.name

  tags = {
    Component = "EC2"
  }
}

resource "aws_iam_role_policy_attachment" "ec2_ssm_managed" {
  role       = aws_iam_role.ec2_instance.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy" "ec2_ecr_pull" {
  name = "moss-marrow-ec2-ecr-pull"
  role = aws_iam_role.ec2_instance.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ECRAuth"
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken"]
        Resource = "*"
      },
      {
        Sid    = "PullImages"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:BatchGetImage",
          "ecr:GetDownloadUrlForLayer"
        ]
        Resource = [
          aws_ecr_repository.frontend.arn,
          aws_ecr_repository.backend.arn
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy" "ec2_secrets_read" {
  name = "moss-marrow-ec2-secrets-read"
  role = aws_iam_role.ec2_instance.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "GetApplicationSecrets"
        Effect = "Allow"
        Action = ["secretsmanager:GetSecretValue"]
        Resource = [
          aws_secretsmanager_secret.mongodb_uri.arn,
          aws_secretsmanager_secret.jwt_secret.arn
        ]
      }
    ]
  })
}
