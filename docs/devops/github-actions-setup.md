# GitHub Actions Setup — MOSS & MARROW

## Required GitHub Secrets

Configure these in: **GitHub → Settings → Secrets and variables → Actions → Secrets**

### AWS Infrastructure Secrets (required for ECR and EKS)

| Secret Name | Description | Example |
|---|---|---|
| `AWS_ECR_ROLE_ARN` | IAM role ARN for ECR push (used by container-release.yml) | `arn:aws:iam::123456789012:role/moss-marrow-ecr-push` |
| `AWS_DEPLOY_ROLE_ARN` | IAM role ARN for EKS deployment (used by cd.yml) | `arn:aws:iam::123456789012:role/moss-marrow-eks-deploy` |

### Application Secrets (required for Kubernetes deployment)

| Secret Name | Description |
|---|---|
| `MONGODB_URI` | Full MongoDB connection URI for production (Atlas recommended for K8s) |
| `JWT_ACCESS_SECRET` | Minimum 32-character random secret for JWT signing |
| `PIXABAY_API_KEY` | Pixabay API key (optional — only needed for image review feature) |

### Optional Secrets

| Secret Name | Description | When Required |
|---|---|---|
| `SONAR_TOKEN` | SonarQube Cloud analysis token | When `SONAR_ENABLED=true` variable is set |
| `GITLEAKS_LICENSE` | Gitleaks license key | Only for private repositories |

---

## Required GitHub Variables

Configure these in: **GitHub → Settings → Secrets and variables → Actions → Variables**

| Variable Name | Description | Example |
|---|---|---|
| `AWS_REGION` | AWS region for ECR and EKS | `us-east-1` |
| `AWS_ACCOUNT_ID` | 12-digit AWS account ID | `123456789012` |
| `ECR_REPOSITORY_FRONTEND` | ECR repository name for the frontend image | `moss-marrow-frontend` |
| `ECR_REPOSITORY_BACKEND` | ECR repository name for the backend image | `moss-marrow-backend` |
| `EKS_CLUSTER_NAME` | EKS cluster name | `moss-marrow-cluster` |
| `K8S_NAMESPACE` | Kubernetes namespace | `moss-marrow` |
| `SONAR_ENABLED` | Set to `'true'` to activate SonarQube scanning | `true` |

---

## GitHub Environments

Create these in: **GitHub → Settings → Environments**

### `production`
- **Required reviewers**: Add at least one reviewer who must approve before deployment.
- **Deployment branches**: Restrict to `main` branch only.

### `staging` (optional)
- No required reviewers.
- Restrict to `main` branch.

---

## CodeQL Setup

CodeQL requires no additional configuration. GitHub provides the analysis infrastructure automatically for public repositories and repositories with GitHub Advanced Security.

Ensure the repository has **Security → Code scanning** enabled in GitHub Settings.

---

## Dependabot Setup

Dependabot is configured via `.github/dependabot.yml`. No additional setup is needed.

After first push, Dependabot will appear under **Insights → Dependency graph → Dependabot**.

---

## SonarQube Setup (Optional)

1. Create an account at [sonarcloud.io](https://sonarcloud.io)
2. Import the MOSS & MARROW repository.
3. Generate a project analysis token.
4. Add `SONAR_TOKEN` to GitHub Secrets.
5. Add `SONAR_ORGANIZATION` to GitHub Variables.
6. Set `SONAR_ENABLED` variable to `true`.
7. Add a `sonar-project.properties` file to the repository root:

```properties
sonar.projectKey=your-org_moss-marrow
sonar.organization=your-org
sonar.sources=frontend/src,backend/src
sonar.exclusions=**/node_modules/**,**/dist/**,**/cache/**
```

---

## Verifying the Setup

After configuring secrets and variables, trigger a manual workflow run:

1. Go to **Actions → CI → Run workflow**
2. CI runs without any secrets required.
3. For Container Release: **Actions → Container Release → Run workflow** (requires AWS secrets).

