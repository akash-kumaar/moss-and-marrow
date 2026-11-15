# CI/CD Architecture — MOSS & MARROW

## Overview

MOSS & MARROW uses a modular, security-first GitHub Actions CI/CD pipeline. The architecture separates concerns across five dedicated workflows, enforces supply-chain security, and gates AWS deployments safely until infrastructure is provisioned.

## Workflow Map

```
Pull Request / Push to main
         │
         ├─── ci.yml              ← Always runs: build + Docker validation
         ├─── security.yml        ← Always runs: Gitleaks, npm audit, Trivy
         ├─── codeql.yml          ← Always runs: Static analysis
         │
Push to main only
         │
         └─── container-release.yml  ← Builds, signs, publishes to ECR
                      │
                      └─── cd.yml  ← Deploys to EKS (gated by environment approval)
```

## Workflow Responsibilities

| Workflow | Trigger | Purpose |
|---|---|---|
| `ci.yml` | PR + push to main | Validate frontend build, backend syntax, Docker builds |
| `security.yml` | PR + push + daily | Gitleaks, npm audit, Trivy FS + container scans, SonarQube |
| `codeql.yml` | PR + push + weekly | Semantic static analysis (JavaScript) |
| `container-release.yml` | Push to main only | Build, push to ECR, sign with Cosign, generate SBOM + provenance |
| `cd.yml` | After container-release | Deploy digest to EKS, verify, roll back on failure |
| `dependabot.yml` | Weekly | Automated dependency update PRs |

## CI Job Execution Order

```
frontend-build  ──┐
                  ├──► docker-build  (parallel after both pass)
backend-validate ─┘
```

Frontend and backend jobs run in parallel. The Docker build job waits for both.

## Security Layers

1. **Gitleaks** — Scans all Git history for committed secrets
2. **npm audit** — Flags critical/high CVEs in dependencies
3. **Trivy filesystem** — Scans source code packages
4. **Trivy container** — Scans built Docker images including OS packages
5. **CodeQL** — Finds logic and security bugs at the AST level
6. **Cosign** — Signs published images with GitHub OIDC (keyless)
7. **SBOM** — CycloneDX/SPDX bill of materials for each image
8. **Provenance** — Signed build attestations linking image to commit + workflow

## Key Principles

- **Build once**: Images are built in `container-release.yml` and deployed by digest — never rebuilt for production
- **No `latest` tags**: All deployments use immutable SHA digests
- **OIDC only**: AWS authentication uses ephemeral OIDC tokens; no permanent access keys
- **Fork isolation**: Fork PRs never receive privileged secrets
- **Gated CD**: Production deployments require GitHub Environment reviewer approval
- **Automatic rollback**: Failed rollouts trigger `kubectl rollout undo` automatically

