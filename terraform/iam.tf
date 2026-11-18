data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

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
            "token.actions.githubusercontent.com:sub" = "repo:akash-kumaar@217486588/moss-and-marrow@1458106685:ref:refs/heads/main"
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

output "github_ecr_role_arn" {
  description = "IAM role assumed by GitHub Actions for ECR publishing"
  value       = aws_iam_role.github_ecr_publisher.arn
}
