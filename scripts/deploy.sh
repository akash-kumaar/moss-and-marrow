#!/bin/bash
# =============================================================================
# MOSS & MARROW — EC2 Deployment Script
# Secure deployment via AWS Systems Manager Run Command or CLI.
# Accepts digests via SSM environment variables (SSM_frontendDigest, SSM_backendDigest)
# or positional arguments ($1, $2).
# =============================================================================
set +x  # Never trace — prevent printing secrets

set -euo pipefail

readonly DEPLOY_DIR="/opt"
readonly COMPOSE_FILE="${DEPLOY_DIR}/docker-compose.deploy.yml"
readonly DIGESTS_FILE="${DEPLOY_DIR}/current_digests.env"
readonly PREVIOUS_DIGESTS_FILE="${DEPLOY_DIR}/previous_digests.env"
readonly TLS_DIR="${DEPLOY_DIR}/moss-tls"
readonly ACME_WEBROOT="${DEPLOY_DIR}/moss-acme-webroot"
readonly CERT_ROOT="/etc/letsencrypt"
umask 077
readonly AWS_REGION="ap-south-1"
readonly ECR_REGISTRY="874940900689.dkr.ecr.${AWS_REGION}.amazonaws.com"
PUBLIC_IP="${MOSS_PUBLIC_IP:-13.204.246.90}"
if [[ -r /etc/moss-marrow/public-ip ]]; then
  PUBLIC_IP=$(</etc/moss-marrow/public-ip)
fi
if [[ ! "$PUBLIC_IP" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]; then
  echo 'ERROR: Invalid public IP configuration' >&2
  exit 1
fi

# Persistent host paths survive immutable frontend image replacements.
mkdir -p "$TLS_DIR" "$ACME_WEBROOT/.well-known/acme-challenge"
[[ -e "$TLS_DIR/https-server.conf" ]] || : > "$TLS_DIR/https-server.conf"
[[ -e "$TLS_DIR/https-redirect.conf" ]] || : > "$TLS_DIR/https-redirect.conf"
chmod 0755 "$TLS_DIR" "$ACME_WEBROOT" "$ACME_WEBROOT/.well-known" "$ACME_WEBROOT/.well-known/acme-challenge"
chmod 0644 "$TLS_DIR/https-server.conf" "$TLS_DIR/https-redirect.conf"

# A second deployment must never capture a partially replaced stack.
exec 9>"${DEPLOY_DIR}/.moss-deploy.lock"
flock -n 9 || { echo "Deployment already in progress" >&2; exit 1; }

ENV_FILE=$(mktemp /tmp/moss-env.XXXXXXXX)
readonly ENV_FILE
mutating=false
cleanup() {
  local rc=$?
  trap - EXIT INT TERM
  if [[ "$mutating" == true ]]; then
    echo "Replacement failed; restoring the captured application images." >&2
    if render_compose "$previous_frontend" "$previous_backend" &&
       launch && verify "$previous_frontend" "$previous_backend"; then
      echo "Rollback verified." >&2
    else
      echo "CRITICAL: rollback verification failed; operator intervention required." >&2
    fi
    (( rc != 0 )) || rc=1
  fi
  rm -f "$ENV_FILE"
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# --- Resolve and validate digests ---
FRONTEND_DIGEST="${SSM_frontendDigest:-${1:-}}"
BACKEND_DIGEST="${SSM_backendDigest:-${2:-}}"

if [[ -z "${FRONTEND_DIGEST}" ]]; then
  echo "ERROR: Frontend image digest is required (via SSM_frontendDigest or \$1)" >&2
  exit 1
fi

if [[ -z "${BACKEND_DIGEST}" ]]; then
  echo "ERROR: Backend image digest is required (via SSM_backendDigest or \$2)" >&2
  exit 1
fi

if [[ ! "${FRONTEND_DIGEST}" =~ ^sha256:[a-f0-9]{64}$ ]]; then
  echo "ERROR: Invalid frontend digest format. Expected ^sha256:[a-f0-9]{64}$, got: ${FRONTEND_DIGEST}" >&2
  exit 1
fi

if [[ ! "${BACKEND_DIGEST}" =~ ^sha256:[a-f0-9]{64}$ ]]; then
  echo "ERROR: Invalid backend digest format. Expected ^sha256:[a-f0-9]{64}$, got: ${BACKEND_DIGEST}" >&2
  exit 1
fi

FRONTEND_IMAGE="${ECR_REGISTRY}/moss-marrow/frontend@${FRONTEND_DIGEST}"
BACKEND_IMAGE="${ECR_REGISTRY}/moss-marrow/backend@${BACKEND_DIGEST}"

echo "Starting deployment for MOSS & MARROW:"
echo "  Frontend image: ${FRONTEND_IMAGE}"
echo "  Backend image:  ${BACKEND_IMAGE}"

capture() {
  local service=$1 name="moss_marrow_$1" ref digest actual expected
  ref=$(docker inspect -f '{{.Config.Image}}' "$name") || return 1
  digest=${ref##*@}
  [[ "$digest" =~ ^sha256:[a-f0-9]{64}$ && "$ref" == "$ECR_REGISTRY/moss-marrow/$service@$digest" ]] || return 1
  grep -Fxq "PREV_${service^^}_DIGEST=$digest" "$DIGESTS_FILE" || return 1
  actual=$(docker inspect -f '{{.Image}}' "$name") || return 1
  expected=$(docker image inspect -f '{{.Id}}' "$ref") || return 1
  [[ "$actual" == "$expected" ]] || return 1
  printf '%s' "$ref"
}
previous_frontend=$(capture frontend) || { echo 'Cannot establish frontend rollback target' >&2; exit 1; }
previous_backend=$(capture backend) || { echo 'Cannot establish backend rollback target' >&2; exit 1; }

verify() {
  local fe=$1 be=$2
  local origin=http://127.0.0.1 curl_resolve=()
  if [[ -s "$TLS_DIR/https-server.conf" ]]; then
    origin="https://${PUBLIC_IP}"
    curl_resolve=(--connect-to "${PUBLIC_IP}:443:127.0.0.1:443")
  fi
  [[ "$(docker inspect -f '{{.Config.Image}}' moss_marrow_frontend)" == "$fe" ]] &&
  [[ "$(docker inspect -f '{{.Config.Image}}' moss_marrow_backend)" == "$be" ]] &&
  [[ "$(docker inspect -f '{{.State.Health.Status}}' moss_marrow_backend)" == healthy ]] &&
  curl -fsS --max-time 5 "${curl_resolve[@]}" "${origin}/" | grep 'id="root"' >/dev/null &&
  curl -fsS --max-time 5 "${curl_resolve[@]}" "${origin}/api/v1/health" | grep '"status":"ok"' >/dev/null
}
verify "$previous_frontend" "$previous_backend" || { echo 'Previous application failed health verification' >&2; exit 1; }
# --- Authenticate Docker to ECR using EC2 instance profile ---
echo "Authenticating Docker to Amazon ECR..."
aws ecr get-login-password --region "${AWS_REGION}" | \
  docker login --username AWS --password-stdin "${ECR_REGISTRY}" >/dev/null 2>&1

# --- Pull immutable images ---
echo "Pulling images..."
docker pull "${FRONTEND_IMAGE}"
docker pull "${BACKEND_IMAGE}"

# --- Retrieve application secrets from AWS Secrets Manager ---
echo "Retrieving application secrets from AWS Secrets Manager..."
install -m 0600 /dev/null "${ENV_FILE}"

MONGODB_URI="$(aws secretsmanager get-secret-value \
  --region "${AWS_REGION}" \
  --secret-id "moss-marrow/MONGODB_URI" \
  --query 'SecretString' \
  --output text 2>/dev/null)"

JWT_ACCESS_SECRET="$(aws secretsmanager get-secret-value \
  --region "${AWS_REGION}" \
  --secret-id "moss-marrow/JWT_ACCESS_SECRET" \
  --query 'SecretString' \
  --output text 2>/dev/null)"

if [[ -z "${MONGODB_URI}" || "${MONGODB_URI}" == "None" ]]; then
  echo "ERROR: Failed to retrieve MONGODB_URI secret from Secrets Manager" >&2
  exit 1
fi

if [[ -z "${JWT_ACCESS_SECRET}" || "${JWT_ACCESS_SECRET}" == "None" ]]; then
  echo "ERROR: Failed to retrieve JWT_ACCESS_SECRET secret from Secrets Manager" >&2
  exit 1
fi

{
  printf 'MONGODB_URI=%s\n' "${MONGODB_URI}"
  printf 'JWT_ACCESS_SECRET=%s\n' "${JWT_ACCESS_SECRET}"
} >> "${ENV_FILE}"

# --- Generate production Docker Compose specification ---
render_compose() {
local FRONTEND_IMAGE=$1 BACKEND_IMAGE=$2
cat > "${COMPOSE_FILE}.new" <<COMPOSEFILE || return 1
services:
  database:
    image: mongo:7.0
    container_name: moss_marrow_db
    restart: unless-stopped
    environment:
      MONGO_INITDB_DATABASE: moss_and_marrow
    volumes:
      - mongo_data:/data/db
    networks:
      - internal_network
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

  backend:
    image: ${BACKEND_IMAGE}
    container_name: moss_marrow_backend
    restart: unless-stopped
    env_file:
      - ${ENV_FILE}
    environment:
      PORT: "5000"
      HOST: "0.0.0.0"
      NODE_ENV: "production"
      CLIENT_URL: "https://${PUBLIC_IP}"
    depends_on:
      database:
        condition: service_healthy
    networks:
      - internal_network
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:5000/api/v1/health"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 15s

  frontend:
    image: ${FRONTEND_IMAGE}
    container_name: moss_marrow_frontend
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ${TLS_DIR}:/etc/nginx/moss-tls:ro
      - ${CERT_ROOT}:/etc/letsencrypt:ro
      - ${ACME_WEBROOT}:/var/www/acme:ro
    depends_on:
      backend:
        condition: service_healthy
    networks:
      - internal_network

networks:
  internal_network:
    driver: bridge

volumes:
  mongo_data:
    driver: local
COMPOSEFILE

mv "${COMPOSE_FILE}.new" "$COMPOSE_FILE"
}

launch() {
  docker compose -f "$COMPOSE_FILE" up -d --no-deps --pull never --wait --wait-timeout 65 backend frontend
}

cp "$DIGESTS_FILE" "$PREVIOUS_DIGESTS_FILE"
mutating=true
render_compose "$FRONTEND_IMAGE" "$BACKEND_IMAGE"
launch
verify "$FRONTEND_IMAGE" "$BACKEND_IMAGE"
printf 'PREV_FRONTEND_DIGEST=%s\nPREV_BACKEND_DIGEST=%s\n' "$FRONTEND_DIGEST" "$BACKEND_DIGEST" > "$DIGESTS_FILE.new"
mv "$DIGESTS_FILE.new" "$DIGESTS_FILE"
mutating=false
echo "Deployment verified."
