# Application rollback

## Scope
Application images only: no database commands, volume operations, TLS edits, monitoring changes or infrastructure apply. Application data/schema changes are not reversed. Select backward-compatible releases. ECR lifecycle policies can still delete images: ten metadata records do not guarantee retention in ECR.

## Setup requiring separate review
The SSM source change adds operation (deploy/rollback), releaseId and commitSha to the existing document, dispatches the verified payload to /opt/deploy.sh or /opt/rollback.sh and increases execution timeout to 600 seconds. Image digests become optional at the document level for rollback, but deploy.sh still requires valid digests and now requires the full commit SHA. Apply only an independently reviewed targeted SSM document plan; never a full plan. Nothing was applied during implementation. No IAM edits: the workflow uses the existing AWS_DEPLOY_ROLE_ARN and existing document ARN, and EC2 checks image availability using its permitted ECR BatchGetImage API.

## History
Successful deployments append ID, commit, two image digests and UTC timestamp to /opt/moss-releases.json after health checks. Atomic replacement, mode 0600, last ten entries, same host deployment lock. Metadata errors preserve the prior file and trigger the existing application recovery, restoring current_digests.env too. Pre-implementation releases are not seeded or invented. Deploy the updated workflow/document first to establish history.

Use an approved secure host session to list IDs: sudo cat /opt/moss-releases.json. This file is not publicly served.

## Operator workflow
After reviewed changes reach main and the SSM default version is updated: GitHub Actions > Rollback Production > Run workflow > main > paste an exact release ID. Only main may execute. GitHub concurrency matches CD; both scripts also use /opt/.moss-deploy.lock. Busy operations fail without replacement.

The script validates metadata, captures current image IDs and environment, checks both ECR images and pulls exact digests before replacement. It reuses the production Compose file by privately copying it, replacing application image references and removing only the expired deploy-script env_file reference. A private JSON environment override preserves the live backend environment. The Compose project is read from the current backend label, not guessed. Unexpected Compose layout or absent current backend causes refusal. Temporary environment files are private and removed on exit.

Only backend/frontend run with --no-deps --pull never --wait. Database volume, network, port and TLS declarations are carried through, with no database service operation. Success checks expected references, backend health, frontend HTML and health API, using trusted HTTPS when configured. current_digests.env is synchronized atomically. History stays unchanged. The production Compose file is atomically updated with only the two application image references; all other content is retained. The next normal deployment regenerates Compose as before.

## Failure handling
A failure after mutation triggers replacement with the captured pre-rollback images and environment, then repeats health verification. Recovery success is logged but the workflow still fails. Failed recovery reports CRITICAL and stops. Hard kills and host failures cannot run shell exit traps: inspect the live stack before retrying. No database restore is attempted.

## Offline checks
- bash -n scripts/deploy.sh scripts/rollback.sh scripts/test-deploy.sh
- bash scripts/test-deploy.sh
- python3 scripts/test-rollback.py

All rollback test commands use temporary directories and fake AWS/Docker/curl. No production rollback or deployment was run. Real SSM integration and live image compatibility remain operator checks.
