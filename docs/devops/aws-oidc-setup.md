# AWS OIDC Configuration — MOSS & MARROW

## Why OIDC?

GitHub Actions OIDC (OpenID Connect) allows workflows to authenticate to AWS using short-lived, ephemeral tokens instead of long-lived access key pairs. This eliminates the need to store `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` as GitHub secrets.

---

## Step 1: Create the GitHub OIDC Provider in AWS

This is a one-time setup per AWS account.

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

Verify it was created:
```bash
aws iam list-open-id-connect-providers
```

---

## Step 2: Create the ECR Push IAM Role

This role is assumed by the `container-release.yml` workflow.

**Trust policy** — save as `trust-ecr.json`:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::YOUR_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:YOUR_GITHUB_USERNAME/MOSS_MARROW:ref:refs/heads/main"
        }
      }
    }
  ]
}
```

Create the role:
```bash
aws iam create-role \
  --role-name moss-marrow-ecr-push \
  --assume-role-policy-document file://trust-ecr.json

aws iam attach-role-policy \
  --role-name moss-marrow-ecr-push \
  --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPowerUser
```

Add the ARN to GitHub secrets as `AWS_ECR_ROLE_ARN`.

---

## Step 3: Create ECR Repositories

```bash
aws ecr create-repository \
  --repository-name moss-marrow-frontend \
  --image-scanning-configuration scanOnPush=true \
  --image-tag-mutability IMMUTABLE \
  --region YOUR_REGION

aws ecr create-repository \
  --repository-name moss-marrow-backend \
  --image-scanning-configuration scanOnPush=true \
  --image-tag-mutability IMMUTABLE \
  --region YOUR_REGION
```

> **IMMUTABLE** tags prevent overwriting a published tag. Always use digest references for deployment.

---

## Step 4: Create the EKS Deploy IAM Role

This role is assumed by the `cd.yml` workflow.

**Trust policy** — save as `trust-deploy.json`:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::YOUR_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:YOUR_GITHUB_USERNAME/MOSS_MARROW:environment:production"
        }
      }
    }
  ]
}
```

```bash
aws iam create-role \
  --role-name moss-marrow-eks-deploy \
  --assume-role-policy-document file://trust-deploy.json
```

Attach required policies:
```bash
# ECR read access to pull images
aws iam attach-role-policy \
  --role-name moss-marrow-eks-deploy \
  --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly

# EKS describe-cluster (needed for kubeconfig)
aws iam create-policy \
  --policy-name moss-marrow-eks-deploy-policy \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": ["eks:DescribeCluster"],
      "Resource": "arn:aws:eks:YOUR_REGION:YOUR_ACCOUNT_ID:cluster/moss-marrow-cluster"
    }]
  }'

aws iam attach-role-policy \
  --role-name moss-marrow-eks-deploy \
  --policy-arn arn:aws:iam::YOUR_ACCOUNT_ID:policy/moss-marrow-eks-deploy-policy
```

The EKS cluster also needs a `aws-auth` ConfigMap entry granting this IAM role Kubernetes RBAC permissions. After creating the EKS cluster:

```bash
kubectl edit configmap aws-auth -n kube-system
```

Add:
```yaml
mapRoles:
  - rolearn: arn:aws:iam::YOUR_ACCOUNT_ID:role/moss-marrow-eks-deploy
    username: moss-marrow-deploy
    groups:
      - moss-marrow-deployers  # Bind this to a Kubernetes Role/ClusterRole
```

---

## Step 5: Add Secrets and Variables to GitHub

After completing the above:

1. Add `AWS_ECR_ROLE_ARN` as a GitHub secret.
2. Add `AWS_DEPLOY_ROLE_ARN` as a GitHub secret.
3. Add `AWS_REGION` as a GitHub variable.
4. Add `AWS_ACCOUNT_ID` as a GitHub variable.
5. Add `ECR_REPOSITORY_FRONTEND` as a GitHub variable (`moss-marrow-frontend`).
6. Add `ECR_REPOSITORY_BACKEND` as a GitHub variable (`moss-marrow-backend`).

---

## Verifying OIDC Authentication

Trigger a manual run of `container-release.yml`. The workflow logs will show:
- `✅ AWS OIDC authentication succeeded.` — OIDC is working.
- `⚠️ AWS OIDC authentication was skipped or failed.` — Check the IAM role trust policy and secret values.

