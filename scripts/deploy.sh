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
readonly ENV_FILE="/tmp/.moss_marrow_env.$$"
readonly AWS_REGION="ap-south-1"
readonly ECR_REGISTRY="874940900689.dkr.ecr.${AWS_REGION}.amazonaws.com"

# --- Guaranteed cleanup on every exit path ---
cleanup() {
  local exit_code=$?
  if [[ -f "${ENV_FILE}" ]]; then
    rm -f "${ENV_FILE}"
  fi
  exit "${exit_code}"
}
trap cleanup EXIT INT TERM

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

# --- Preserve current digests for rollback ---
if [[ -f "${DIGESTS_FILE}" ]]; then
  cp "${DIGESTS_FILE}" "${PREVIOUS_DIGESTS_FILE}"
fi

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
cat > "${COMPOSE_FILE}" <<COMPOSEFILE
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
      CLIENT_URL: "http://localhost:80"
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

echo "Generated Docker Compose specification."

# --- Deploy services ---
echo "Launching containers with Docker Compose..."
docker compose -f "${COMPOSE_FILE}" up -d --remove-orphans

# --- Health check validation ---
echo "Validating application health..."
HEALTH_OK=false

for i in $(seq 1 24); do
  sleep 5
  CONTAINER_ID="$(docker compose -f "${COMPOSE_FILE}" ps -q backend 2>/dev/null || true)"
  if [[ -z "${CONTAINER_ID}" ]]; then
    echo "  Attempt ${i}/24 — backend container not found"
    continue
  fi

  # Query health endpoint from inside the backend container (supports wget or node)
  HTTP_RESPONSE="$(docker exec "${CONTAINER_ID}" sh -c \
    'wget -qO- -T 3 "http://127.0.0.1:5000/api/v1/health" 2>/dev/null || node -e "const http=require(\"http\");http.get(\"http://127.0.0.1:5000/api/v1/health\",(r)=>{let d=\"\";r.on(\"data\",c=>d+=c);r.on(\"end\",()=>console.log(d))}).on(\"error\",()=>{});" 2>/dev/null' || true)"

  if echo "${HTTP_RESPONSE}" | grep -q '"status":"ok"'; then
    echo "✅ Application health check passed (/api/v1/health returned status: ok)"
    HEALTH_OK=true
    break
  fi

  echo "  Attempt ${i}/24 — waiting for backend to be healthy..."
done

if [[ "${HEALTH_OK}" != "true" ]]; then
  echo "❌ ERROR: Backend health check failed after 24 attempts (120s)." >&2

  # --- Automated non-recursive rollback ---
  if [[ -f "${PREVIOUS_DIGESTS_FILE}" ]]; then
    echo "⚠️ Initiating automated rollback to previous deployment..."
    # shellcheck source=/dev/null
    source "${PREVIOUS_DIGESTS_FILE}"
    PREV_FE="${ECR_REGISTRY}/moss-marrow/frontend@${PREV_FRONTEND_DIGEST}"
    PREV_BE="${ECR_REGISTRY}/moss-marrow/backend@${PREV_BACKEND_DIGEST}"

    sed -i "s|image: ${BACKEND_IMAGE}|image: ${PREV_BE}|" "${COMPOSE_FILE}"
    sed -i "s|image: ${FRONTEND_IMAGE}|image: ${PREV_FE}|" "${COMPOSE_FILE}"

    docker compose -f "${COMPOSE_FILE}" up -d --remove-orphans
    echo "Rollback containers deployed. Preserving original failure status."
  else
    echo "⚠️ No previous deployment record found. Halting failed containers."
    docker compose -f "${COMPOSE_FILE}" down
  fi

  exit 1
fi

# --- Persist current successful digests for future rollback ---
cat > "${DIGESTS_FILE}" <<EOF
PREV_FRONTEND_DIGEST=${FRONTEND_DIGEST}
PREV_BACKEND_DIGEST=${BACKEND_DIGEST}
EOF

echo "✅ MOSS & MARROW deployment completed successfully."
