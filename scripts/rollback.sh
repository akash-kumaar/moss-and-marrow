#!/usr/bin/env bash
# Application images only. Never starts/stops the database or edits TLS files.
set -Eeuo pipefail
set +x
umask 077
readonly DEPLOY_DIR=/opt
readonly COMPOSE_FILE="$DEPLOY_DIR/docker-compose.deploy.yml"
readonly HISTORY="$DEPLOY_DIR/moss-releases.json"
readonly REGISTRY=874940900689.dkr.ecr.ap-south-1.amazonaws.com
readonly REGION=ap-south-1
release=${1:-}
[[ "$release" =~ ^[a-f0-9]{40}-[0-9]{8}T[0-9]{6}Z-[a-f0-9]{8}$ ]] || { echo 'Invalid release identifier' >&2; exit 1; }
exec 9>"$DEPLOY_DIR/.moss-deploy.lock"
flock -n 9 || { echo 'Deployment or rollback already in progress' >&2; exit 1; }
[[ -r "$HISTORY" && -f "$COMPOSE_FILE" ]] || { echo 'Release history or production Compose file missing' >&2; exit 1; }
work=$(mktemp -d "$DEPLOY_DIR/.moss-rollback.XXXXXXXX")
mutating=false
cleanup() {
  local rc=$?
  trap - EXIT INT TERM
  if [[ "$mutating" == true ]]; then
    echo 'Rollback failed; recovering captured application images.' >&2
    if render "$old_fe" "$old_be" && launch && verify "$old_fe" "$old_be" &&
       cp "$work/original.yml" "$COMPOSE_FILE.new" && mv "$COMPOSE_FILE.new" "$COMPOSE_FILE"; then
      echo 'Recovery verified; rollback remains failed.' >&2
    else
      echo 'CRITICAL: recovery failed. Stop and inspect application health.' >&2
    fi
    rc=1
  fi
  rm -rf -- "$work"
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
# Parse JSON as data, never source or eval host metadata.
python3 - "$HISTORY" "$release" > "$work/selected" <<'PY'
import json,re,sys
rows=json.load(open(sys.argv[1]))
assert isinstance(rows,list) and 0<len(rows)<=10, 'Invalid release history'
selected=[]
for r in rows:
    assert re.fullmatch(r'[a-f0-9]{40}-[0-9]{8}T[0-9]{6}Z-[a-f0-9]{8}',r['id'])
    assert re.fullmatch(r'[a-f0-9]{40}',r['commit'])
    assert r['id'].startswith(r['commit']+'-')
    for k in ('frontend','backend'): assert re.fullmatch(r'sha256:[a-f0-9]{64}',r[k])
    assert re.fullmatch(r'[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z',r['timestamp'])
    if r['id']==sys.argv[2]: selected.append(r)
assert len(selected)==1, 'Release not found or ambiguous'
print(selected[0]['frontend']); print(selected[0]['backend'])
PY
mapfile -t target < "$work/selected"
[[ ${#target[@]} == 2 ]]
fe="$REGISTRY/moss-marrow/frontend@${target[0]}"
be="$REGISTRY/moss-marrow/backend@${target[1]}"
capture() {
  local service=$1 ref actual expected
  ref=$(docker inspect -f '{{.Config.Image}}' "moss_marrow_$service")
  local digest=${ref##*@}
  [[ "$digest" =~ ^sha256:[a-f0-9]{64}$ && "$ref" == "$REGISTRY/moss-marrow/$service@$digest" ]] || return 1
  actual=$(docker inspect -f '{{.Image}}' "moss_marrow_$service")
  expected=$(docker image inspect -f '{{.Id}}' "$ref")
  [[ "$actual" == "$expected" ]] || return 1
  printf '%s' "$ref"
}
project=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' moss_marrow_backend)
[[ "$project" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || { echo 'Cannot determine production Compose project' >&2; exit 1; }
[[ $(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' moss_marrow_frontend) == "$project" ]] || exit 1
old_fe=$(capture frontend) || { echo 'Cannot capture current frontend' >&2; exit 1; }
project=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' moss_marrow_backend)
[[ "$project" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || { echo 'Cannot establish Compose project' >&2; exit 1; }
old_be=$(capture backend) || { echo 'Cannot capture current backend' >&2; exit 1; }
# Reuse the live backend environment; the deploy script removes its temporary env_file.
# A private JSON override preserves exact values, including dollar signs and newlines.
docker inspect -f '{{json .Config.Env}}' moss_marrow_backend > "$work/environment.json"
cp "$COMPOSE_FILE" "$work/original.yml"
render() {
  python3 - "$work" "$1" "$2" <<'PY'
import json,pathlib,re,sys
p=pathlib.Path(sys.argv[1]); text=(p/'original.yml').read_text()
# Only this generated deploy Compose shape is supported; fail closed on drift.
for service,image in [('frontend',sys.argv[2]),('backend',sys.argv[3])]:
    pattern=r'(?m)^(  '+service+r':\n    image: )[^\n]+'
    text,n=re.subn(pattern,lambda m:m[1]+image,text)
    assert n==1,'Unexpected Compose service layout'
(p/'persistent.yml').write_text(text)
text,n=re.subn(r'(?m)^    env_file:\n      - /tmp/moss-env\.[A-Za-z0-9]+\n','',text)
assert n==1,'Unexpected backend environment layout'
(p/'compose.yml').write_text(text)
env=dict(entry.split('=',1) for entry in json.loads((p/'environment.json').read_text()))
env={key:value.replace('$','$$') for key,value in env.items()}
assert env.get('MONGODB_URI'), 'Current backend database environment missing'
(p/'override.json').write_text(json.dumps({'services':{'backend':{'environment':env}}}))
PY
}
launch() {
  docker compose --project-name "$project" -f "$work/compose.yml" -f "$work/override.json" up -d --no-deps --pull never --wait --wait-timeout 65 backend frontend
}
verify_once() {
  local origin=http://127.0.0.1 ip args=()
  if [[ -s "$DEPLOY_DIR/moss-tls/https-server.conf" ]]; then
    ip=$(</etc/moss-marrow/public-ip)
    [[ "$ip" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] || return 1
    origin="https://$ip"; args=(--connect-to "$ip:443:127.0.0.1:443")
  fi
  docker exec moss_marrow_frontend nginx -t &&
  [[ $(docker inspect -f '{{.Config.Image}}' moss_marrow_frontend) == "$1" ]] &&
  [[ $(docker inspect -f '{{.Config.Image}}' moss_marrow_backend) == "$2" ]] &&
  [[ $(docker inspect -f '{{.State.Health.Status}}' moss_marrow_backend) == healthy ]] &&
  curl -fsS --connect-timeout 3 --max-time 10 "${args[@]}" "$origin/" | grep 'id="root"' >/dev/null &&
  curl -fsS --connect-timeout 3 --max-time 10 "${args[@]}" "$origin/api/v1/health" | grep '"status":"ok"' >/dev/null
}
# Container health does not guarantee the TLS listener is ready on its first request.
# Retrying is bounded; certificate validation and every application check still apply.
verify() {
  local attempt
  for attempt in 1 2 3 4 5; do
    if verify_once "$@"; then return 0; fi
    echo "Application verification failed (attempt $attempt/5)." >&2
    if (( attempt < 5 )); then sleep 2; fi
  done
  echo 'Application verification exhausted all attempts.' >&2
  return 1
}
verify "$old_fe" "$old_be" || { echo 'Current application is unhealthy; refusing rollback' >&2; exit 1; }
# Existence checks and pulls complete before any container replacement.
for service in frontend backend; do
  digest=${target[0]}; [[ "$service" != backend ]] || digest=${target[1]}
  found=$(aws ecr batch-get-image --region "$REGION" --repository-name "moss-marrow/$service" --image-ids "imageDigest=$digest" --query 'images[0].imageId.imageDigest' --output text)
  [[ "$found" == "$digest" ]] || { echo "ECR image missing: $service" >&2; exit 1; }
done
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$REGISTRY" >/dev/null 2>&1
docker pull "$fe"
docker pull "$be"
render "$fe" "$be"
mutating=true
launch
verify "$fe" "$be"
# Keep the existing deploy script's capture contract synchronized after verification.
printf 'PREV_FRONTEND_DIGEST=%s\nPREV_BACKEND_DIGEST=%s\n' "${target[0]}" "${target[1]}" > "$work/digests"
# Persist only application image references; all other production Compose content is retained.
mv "$work/persistent.yml" "$COMPOSE_FILE"
mv "$work/digests" "$DEPLOY_DIR/current_digests.env"
mutating=false
echo "Rollback verified: $release"
