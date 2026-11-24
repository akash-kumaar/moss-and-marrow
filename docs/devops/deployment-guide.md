# EC2 production deployment and recovery

Production runs Docker Compose on a single EC2 instance in ap-south-1. Container Release builds Git-SHA-tagged images, checks exact ECR digests and publishes verified-release.txt. CD accepts only a successful main release run, downloads its attempt-specific artifact, compares the SHA and digests against ECR and requires exactly one running instance tagged moss-marrow-app in the expected account. SSM permissions restrict SendCommand to the existing document and instance. CD polls that specific command and instance. Manual SHA dispatch is disabled.

## Before authorizing rollout

1. Use an authenticated operator session with scoped STS identity, EC2 describe, ECR describe, SSM instance/invocation read and approved Session Manager access. Confirm region, account, instance, current public address, disk space, database health, container health and both running repo@digest references.
2. Verify the deployed SSM document accepts scriptSha256 and checks the installed root-owned /opt/deploy.sh against the release checksum. Provision these two updates under separate change approval before the first rollout. Deploy scripts must have LF endings and mode 0700. Changing cloud-init user data can cause Terraform to propose replacing EC2. Review the plan and reject any instance replacement. This repository change alone does not install a host script.
3. Validate /opt/current_digests.env contains PREV_FRONTEND_DIGEST and PREV_BACKEND_DIGEST matching running containers and cached images. First bootstrap and recovery without this record require a separate operator procedure. Verify Secrets Manager access to the existing MONGODB_URI and JWT_ACCESS_SECRET entries. Optional Turnstile configuration and per-process rate limit defaults are in docs/api-hardening.md.
4. Verify an approved encrypted, access-controlled backup destination, free space and a consistency strategy. For standalone MongoDB coordinate a quiet write window, capture counts and indexes, stream mongodump --archive --gzip for the actual database to a private archive (umask 077), and verify its SHA-256 checksum. Restore via mongorestore into a fresh isolated MongoDB 7 instance. Compare counts and index definitions and run the candidate index initializer there. Never test a restore against production.
5. Review reservation reference uniqueness, requestKey presence/type/null duplicates, slot types and duplicate active branch/date/time/slot values. Initialization fails closed on incompatible data/index definitions. Legacy records missing keys are preserved. Investigate conflicts without rewriting customer records.
6. Require green security checks and explicit maintenance-window approval. Compare release and running digests after CD. Read-only probes: homepage, menu, reservation form, configuration and readiness. Confirm monitoring ingestion and reservation counts. Keep write/abuse tests isolated.

## Failure handling

Before replacement, failed preflight, registry pulls or secret lookup leave containers running. After replacement starts the script restores captured application image references and checks both identities, backend container health, the homepage and the proxied health response. Compose targets backend and frontend with --no-deps and --pull never. MongoDB and its named volume are outside replacement and rollback. New indexes and reservations persist. The original deployment exits unsuccessfully even after verified rollback.

If rollback verification fails, stop deployment attempts and inspect the affected host using SSM. Never reset the database. For an approved manual application recovery use the recorded known-good immutable digests and the approved on-host procedure. Do not treat a green backend health response alone as confirmation that the frontend was restored. A host crash, hard kill, exhausted disk, missing image or failed Docker daemon can still require operator recovery. The SSM time budget must cover pull, replacement and rollback; verify available time and registry responsiveness before rollout.

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


```

