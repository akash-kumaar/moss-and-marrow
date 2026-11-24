# Security Scanning — MOSS & MARROW

## Release enforcement

Container Release calls security.yml at the same revision. Both exact ECR digest scans use exit-code 1 on HIGH/CRITICAL, including unfixed findings. Scanner errors also fail the release. A successful verified-release manifest is required by CD. An artifact or SHA tag from a failed release does not authorize deployment. Independent checks on other commits are not substitutes. CodeQL alerts are separate from the Container Release gate.

## Security Tool Overview

| Tool | Type | Trigger | Blocking |
|---|---|---|---|
| Gitleaks | Secret detection | PR + push + daily | Yes — critical |
| npm audit | Dependency CVE scan | PR + push + daily | Yes — high/critical |
| Trivy (FS) | Package vulnerability scan | PR + push + daily | Yes — high/critical |
| Trivy (container) | Image vulnerability scan | Push to main + daily | Yes — high/critical |
| CodeQL | Static analysis | PR + push + weekly | Yes — via GitHub security alerts |
| SonarQube | Code quality | Push to main (optional) | Optional — configurable |

---

## Gitleaks

**Purpose**: Detect accidentally committed API keys, passwords, tokens, and credentials in source code and Git history.

**Configuration**: Uses Gitleaks default ruleset. Custom rules can be added via a `.gitleaks.toml` file in the repository root.

**If a secret is detected**:
1. Do NOT force-push or rebase to hide the commit — the secret is already potentially exposed.
2. Immediately rotate the leaked credential in the relevant service.
3. Revoke the old credential.
4. Remove the secret from the codebase.
5. Use `git filter-repo` to purge it from history (requires all collaborators to re-clone).
6. Add the secret pattern to `.gitleaks.toml` allowlist if it was a false positive.

**False positive handling**: Add a `# gitleaks:allow` comment on the same line, or use an allowlist in `.gitleaks.toml`.

---

## npm audit

**Severity policy**:
- `critical` → Pipeline fails ❌
- `high` → Pipeline fails ❌
- `moderate` → Reported only, does not block ⚠️
- `low` → Reported only, does not block ℹ️

**To resolve a vulnerability**:
```bash
# Check what is affected
npm audit --omit=dev

# Apply safe updates (patch/minor only)
npm audit fix --omit=dev

# Never use --force without understanding what it changes
```

**If a vulnerability cannot be fixed**: Document it in a `.nsprc` or `npm audit` override, explain why it is accepted, and set a review date.

---

## Trivy

**Filesystem scans**: Run on every PR and push. Scan both `frontend/` and `backend/` for vulnerable packages.

**Container scans**: Run on push to main only (after images are built). Catch OS-level vulnerabilities not visible in the source tree.

**SARIF reports**: Uploaded to GitHub Security → Code scanning alerts. View them in **Security → Code scanning** tab.

**Severity policy**: Same as npm audit — CRITICAL and HIGH cause pipeline failure.

**Unfixed vulnerabilities**: `--ignore-unfixed` is set, meaning Trivy only fails on vulnerabilities that have available fixes. If no fix exists in the upstream package, it is reported but does not block the build.

---

## CodeQL

**Languages scanned**: `javascript-typescript` covers all frontend and backend JavaScript.

**Query suite**: `security-extended` — broader than the default, includes OWASP Top 10 patterns.

**Results location**: **Security → Code scanning alerts** in the GitHub repository.

**False positives**: Dismiss individual alerts in the GitHub Security UI with an explanation.

---

## SonarQube (Optional)

**Status**: Configured but awaiting activation. See `docs/devops/github-actions-setup.md`.

**When activated**: Runs on pushes to `main`. Results are visible in the SonarQube Cloud dashboard.

**Quality gate**: The default SonarQube quality gate checks:
- No new bugs
- No new vulnerabilities
- No new security hotspots (unreviewed)
- Code coverage ≥ 80% (requires test setup — not currently applicable)

---

## Reading Security Reports

### In GitHub Security tab
1. Go to **Security → Code scanning alerts**
2. Filter by tool (Trivy, CodeQL)
3. Click an alert to see the affected file, line, and remediation guidance

### In workflow logs
1. Go to **Actions → Security workflow run**
2. Expand the failing job step
3. SARIF output is available as a downloadable artifact

