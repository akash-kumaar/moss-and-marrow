# Deployment Guide — MOSS & MARROW

## Deployment Overview

MOSS & MARROW uses a "build once, deploy digest" model:

1. `container-release.yml` builds and pushes images to ECR with an immutable SHA tag.
2. `cd.yml` retrieves the exact image digest from ECR and deploys it to EKS.
3. The deployed image is verified (Cosign signature check) before kubectl apply.
4. Rollout is monitored; failed deployments roll back automatically.

---

## Local Development (Docker Compose)

```bash
# Copy and configure environment
cp .env.example .env
# Edit .env — set MONGO_INITDB_ROOT_PASSWORD and JWT_ACCESS_SECRET

# Start all services
docker compose up --build -d

# View running containers
docker compose ps

# View all logs
docker compose logs -f

# View specific service logs
docker compose logs -f backend

# Stop (data preserved)
docker compose down

# Stop and destroy all data
docker compose down -v   # ⚠️ DESTRUCTIVE — deletes MongoDB volume
```

---

## Triggering a Production Deployment

### Automatic (recommended)

Push to `main`. The pipeline runs in this order:
1. CI validates the build.
2. Security scans run in parallel.
3. `container-release.yml` publishes images to ECR.
4. `cd.yml` triggers automatically and waits for reviewer approval.

### Manual

1. Go to **Actions → CD — Deploy to Kubernetes → Run workflow**
2. Select environment: `staging` or `production`
3. Optionally enter a specific Git SHA to deploy
4. Enter a reason for the deployment
5. Click **Run workflow**

For `production`, a reviewer must approve the deployment in the **Environments** approval gate.

---

## Kubernetes Prerequisites Checklist

Before the first EKS deployment:

- [ ] EKS cluster created (`vars.EKS_CLUSTER_NAME`)
- [ ] ECR repositories created (frontend + backend)
- [ ] AWS OIDC provider created (see `aws-oidc-setup.md`)
- [ ] IAM roles created with correct trust policies
- [ ] GitHub secrets configured (see `github-actions-setup.md`)
- [ ] GitHub variables configured
- [ ] GitHub Environment `production` created with required reviewers
- [ ] `kubectl apply -f k8s/namespace.yaml` run once to create the namespace
- [ ] `k8s/config/configmap.yaml` updated with the correct `CLIENT_URL`
- [ ] MongoDB Atlas cluster provisioned (or MongoDB available externally)
- [ ] `secrets.MONGODB_URI` set to the production connection string

---

## Kubernetes Nginx Note

When deployed to Kubernetes, the Nginx proxy_pass in `frontend/nginx.conf` currently points to `http://backend:5000`. In Kubernetes, services are resolved by DNS, not by Docker Compose service names.

**Update required before EKS deployment:**

Change `frontend/nginx.conf` line 18:
```nginx
# Docker Compose (current)
proxy_pass http://backend:5000;

# Kubernetes (required for EKS)
proxy_pass http://moss-marrow-backend.moss-marrow.svc.cluster.local:5000;
```

This change must be made in a separate branch and merged to main before the first EKS deployment.

---

## Monitoring a Rollout

```bash
# Watch rollout progress
kubectl rollout status deployment/moss-marrow-backend -n moss-marrow
kubectl rollout status deployment/moss-marrow-frontend -n moss-marrow

# View pod status
kubectl get pods -n moss-marrow

# View pod logs
kubectl logs -n moss-marrow -l app.kubernetes.io/component=backend --tail=100

# View events (useful for debugging scheduling/image pull issues)
kubectl get events -n moss-marrow --sort-by='.metadata.creationTimestamp'
```

---

## Manual Rollback

If the automatic rollback in CD fails or you need to roll back independently:

```bash
# Roll back to the previous revision
kubectl rollout undo deployment/moss-marrow-backend -n moss-marrow
kubectl rollout undo deployment/moss-marrow-frontend -n moss-marrow

# Verify rollback succeeded
kubectl rollout status deployment/moss-marrow-backend -n moss-marrow

# View rollout history
kubectl rollout history deployment/moss-marrow-backend -n moss-marrow
```

---

## Investigating CI/CD Failures

### CI failure (build or syntax error)
1. Go to the failed workflow run in **Actions**
2. Click the failing job
3. Expand the failing step
4. Address the error in `frontend/` or `backend/`

### Security scan failure (Trivy or npm audit)
1. Go to **Security → Code scanning alerts**
2. Review the affected package
3. Update the dependency: `npm audit fix --omit=dev`
4. If unfixable, assess risk and document a temporary exception

### Container release failure (ECR push)
1. Check AWS OIDC: does the IAM role trust policy match the repository?
2. Check ECR: does the repository exist in the configured region?
3. Check `vars.AWS_REGION` and `vars.ECR_REPOSITORY_*` values

### CD failure (EKS deployment)
1. Check `kubectl get events -n moss-marrow`
2. Check if the image digest exists in ECR
3. Check if `moss-marrow-backend-secret` Kubernetes secret was created
4. Confirm EKS node groups have sufficient capacity
5. Use `kubectl describe pod <pod-name> -n moss-marrow` for detailed errors

