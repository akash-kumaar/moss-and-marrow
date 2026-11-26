#!/usr/bin/env bash
# Run the release script with deterministic adapters; never contact AWS or a daemon.
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
dir=$(mktemp -d)
trap 'rm -rf "$dir"' EXIT
export QA="$dir"
export MOSS_PUBLIC_IP=198.51.100.12
mkdir "$dir/bin"
export PATH="$dir/bin:$PATH"
export OLD="sha256:$(printf '1%.0s' {1..64})" NEW="sha256:$(printf '2%.0s' {1..64})"
sed "s|readonly DEPLOY_DIR=\"/opt\"|readonly DEPLOY_DIR=\"$dir\"|" "$root/scripts/deploy.sh" > "$dir/deploy"
printf '#!/bin/bash\ntrue\n' > "$dir/bin/flock"
printf '#!/bin/bash\necho synthetic-test-value\n' > "$dir/bin/aws"
cat > "$dir/bin/curl" <<'MOCK'
#!/bin/bash
echo "$*" >> "$QA/curl"
if [[ "$*" == *health* ]]; then
  if [[ ( $CASE == health || $CASE == tls_health ) && $(cat "$QA/current") == "$NEW" ]]; then exit 1; fi
  echo '{"status":"ok"}'
else echo '<div id="root"></div>'; fi
MOCK
cat > "$dir/bin/docker" <<'MOCK'
#!/bin/bash
set -eu
case "$1" in
  login) cat >/dev/null;;
  pull) [[ "$CASE" != pull ]];;
  inspect)
    case "$3" in
      '{{.Config.Image}}') echo "874940900689.dkr.ecr.ap-south-1.amazonaws.com/moss-marrow/${4#moss_marrow_}@$(cat "$QA/current")";;
      '{{.Image}}') echo config-id;;
      '{{.State.Health.Status}}') echo healthy;;
      *) exit 8;;
    esac;;
  image) echo config-id;;
  compose)
    [[ "$*" == *'up -d --no-deps --pull never --wait --wait-timeout 65 backend frontend' ]] || exit 8
    grep -q 'mongo_data:/data/db' "$3" || exit 8
    grep -q '443:443' "$3" || exit 8
    grep -q '/etc/nginx/moss-tls:ro' "$3" || exit 8
    grep -q '/var/www/acme:ro' "$3" || exit 8
    grep 'image: .*frontend@' "$3" | cut -d@ -f2 > "$QA/current"
    cat "$QA/current" >> "$QA/replacements"
    if [[ $CASE == rollback_failure || ( $CASE == replacement && $(cat "$QA/current") == "$NEW" ) ]]; then exit 19; fi;;
  *) exit 8;;
esac
MOCK
chmod +x "$dir/bin/"*
for CASE in success tls tls_health pull replacement health missing rollback_failure; do
  export CASE
  rm -rf "$dir/moss-tls"
  if [[ $CASE == tls || $CASE == tls_health ]]; then
    mkdir -p "$dir/moss-tls"
    printf 'server {}\n' > "$dir/moss-tls/https-server.conf"
  fi
  echo "$OLD" > "$dir/current"
  : > "$dir/replacements"
  : > "$dir/curl"
  printf 'PREV_FRONTEND_DIGEST=%s\nPREV_BACKEND_DIGEST=%s\n' "$OLD" "$OLD" > "$dir/current_digests.env"
  if [[ $CASE == missing ]]; then : > "$dir/current_digests.env"; fi
  rc=0; bash "$dir/deploy" "$NEW" "$NEW" > "$dir/log" 2>&1 || rc=$?
  case "$CASE" in
    success) [[ $rc == 0 && $(cat "$dir/current") == "$NEW" ]];;
    tls) [[ $rc == 0 && $(cat "$dir/current") == "$NEW" ]]; grep -q 'https://198.51.100.12' "$dir/curl"; grep -q -- '--connect-to 198.51.100.12:443:127.0.0.1:443' "$dir/curl";;
    tls_health) [[ $rc != 0 && $(cat "$dir/current") == "$OLD" ]]; grep -q 'Rollback verified' "$dir/log"; grep -q 'https://198.51.100.12' "$dir/curl";;
    pull|missing) [[ $rc != 0 && ! -s "$dir/replacements" ]];;
    replacement|health) [[ $rc != 0 && $(cat "$dir/current") == "$OLD" ]]; grep -q 'Rollback verified' "$dir/log";;
    rollback_failure) [[ $rc != 0 ]]; grep -q 'rollback verification failed' "$dir/log";;
  esac
  echo "PASS $CASE"
done
