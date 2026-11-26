#!/usr/bin/env bash
# One-time EC2 setup after a release with the HTTPS-capable frontend/deploy script.
set -euo pipefail
set +x
umask 077

readonly DEFAULT_PUBLIC_IP=13.204.246.90
readonly CERTBOT_IMAGE=certbot/certbot:v5.10.0
readonly CERT_ROOT=/etc/letsencrypt
readonly WEBROOT=/opt/moss-acme-webroot
readonly TLS_DIR=/opt/moss-tls
readonly CONFIG_DIR=/etc/moss-marrow
readonly RENEW_SCRIPT=/usr/local/sbin/moss-marrow-renew-certificate
readonly STAGING_ROOT=/opt/moss-certbot-staging
PUBLIC_IP=${1:-$DEFAULT_PUBLIC_IP}

[[ $EUID == 0 ]] || { echo 'Run as root through the approved SSM operator path.' >&2; exit 1; }
[[ "$PUBLIC_IP" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] || { echo 'A valid IPv4 address is required.' >&2; exit 1; }
command -v docker >/dev/null && command -v systemctl >/dev/null || { echo 'Docker and systemd are required.' >&2; exit 1; }

# Fail safely if this address is not attached to this instance.
imds_token=$(curl --fail --silent --show-error --max-time 2 -X PUT \
  -H 'X-aws-ec2-metadata-token-ttl-seconds: 60' http://169.254.169.254/latest/api/token)
instance_ip=$(curl --fail --silent --show-error --max-time 2 \
  -H "X-aws-ec2-metadata-token: $imds_token" http://169.254.169.254/latest/meta-data/public-ipv4)
unset imds_token
[[ "$instance_ip" == "$PUBLIC_IP" ]] || { echo 'IP does not match this EC2 instance; no changes made.' >&2; exit 1; }

docker inspect moss_marrow_frontend >/dev/null 2>&1 || { echo 'Production frontend is not running.' >&2; exit 1; }
for mount in /etc/nginx/moss-tls /var/www/acme /etc/letsencrypt; do
  docker inspect --format '{{range .Mounts}}{{println .Destination}}{{end}}' moss_marrow_frontend | grep -Fxq "$mount" || {
    echo "Frontend is missing persistent mount $mount; deploy the HTTPS-capable release first." >&2
    exit 1
  }
done

install -d -o root -g root -m 0755 "$CONFIG_DIR" "$TLS_DIR" "$WEBROOT/.well-known/acme-challenge"
install -d -o root -g root -m 0700 "$CERT_ROOT" \
  "$STAGING_ROOT/config" "$STAGING_ROOT/work" "$STAGING_ROOT/logs"
[[ -e "$TLS_DIR/https-server.conf" ]] || install -o root -g root -m 0644 /dev/null "$TLS_DIR/https-server.conf"
[[ -e "$TLS_DIR/https-redirect.conf" ]] || install -o root -g root -m 0644 /dev/null "$TLS_DIR/https-redirect.conf"
printf '%s\n' "$PUBLIC_IP" > "$CONFIG_DIR/public-ip.new"
chmod 0644 "$CONFIG_DIR/public-ip.new"
mv "$CONFIG_DIR/public-ip.new" "$CONFIG_DIR/public-ip"

# Prove the running Nginx serves the exact HTTP-01 webroot before contacting ACME.
probe="moss-marrow-$(date +%s)-$RANDOM"
printf '%s' "$probe" > "$WEBROOT/.well-known/acme-challenge/$probe"
chmod 0644 "$WEBROOT/.well-known/acme-challenge/$probe"
served=$(curl --fail --silent --show-error --max-time 5 -H "Host: $PUBLIC_IP" \
  "http://127.0.0.1/.well-known/acme-challenge/$probe") || {
  rm -f "$WEBROOT/.well-known/acme-challenge/$probe"
  echo 'Nginx ACME webroot check failed; no certificate was requested.' >&2
  exit 1
}
rm -f "$WEBROOT/.well-known/acme-challenge/$probe"
[[ "$served" == "$probe" ]] || { echo 'ACME webroot probe did not match.' >&2; exit 1; }

# Keep staging account/config separate from production. This block is idempotent.
if [[ ! -s "$STAGING_ROOT/config/live/$PUBLIC_IP/fullchain.pem" ]]; then
  docker run --rm \
    -v "$STAGING_ROOT/config:/etc/letsencrypt" \
    -v "$STAGING_ROOT/work:/var/lib/letsencrypt" \
    -v "$STAGING_ROOT/logs:/var/log/letsencrypt" \
    -v "$WEBROOT:/var/www/acme" "$CERTBOT_IMAGE" certonly --staging \
    --non-interactive --agree-tos --register-unsafely-without-email \
    --preferred-profile shortlived --webroot --webroot-path /var/www/acme \
    --ip-address "$PUBLIC_IP" --cert-name "$PUBLIC_IP"
fi
if [[ ! -s "$CERT_ROOT/live/$PUBLIC_IP/fullchain.pem" ]]; then
  docker run --rm -v "$CERT_ROOT:/etc/letsencrypt" -v "$WEBROOT:/var/www/acme" \
    "$CERTBOT_IMAGE" certonly --non-interactive --agree-tos \
    --register-unsafely-without-email --preferred-profile shortlived \
    --webroot --webroot-path /var/www/acme --ip-address "$PUBLIC_IP" --cert-name "$PUBLIC_IP"
fi
docker run --rm -v "$CERT_ROOT:/etc/letsencrypt" -v "$WEBROOT:/var/www/acme" \
  "$CERTBOT_IMAGE" renew --dry-run --preferred-profile shortlived

fullchain="$CERT_ROOT/live/$PUBLIC_IP/fullchain.pem"
privkey="$CERT_ROOT/live/$PUBLIC_IP/privkey.pem"
[[ -s "$fullchain" && -s "$privkey" ]] || { echo 'Expected certificate files are missing.' >&2; exit 1; }
chmod 0600 "$privkey"

tmp=$(mktemp -d "$TLS_DIR/.https-setup.XXXXXX")
cp -p "$TLS_DIR/https-server.conf" "$tmp/server.previous"
cp -p "$TLS_DIR/https-redirect.conf" "$tmp/redirect.previous"
changed=false
rollback() {
  rc=$?
  if [[ "$rc" != 0 && "$changed" == true ]]; then
    cp "$tmp/server.previous" "$TLS_DIR/https-server.conf"
    cp "$tmp/redirect.previous" "$TLS_DIR/https-redirect.conf"
    if docker exec moss_marrow_frontend nginx -t >/dev/null 2>&1; then
      docker exec moss_marrow_frontend nginx -s reload >/dev/null 2>&1 || true
    fi
    echo 'Restored previous Nginx configuration; HTTP service remains available.' >&2
  fi
  rm -rf -- "$tmp"
  exit "$rc"
}
trap rollback EXIT

cat > "$tmp/https-server.conf" <<NGINX
server {
    listen 443 ssl;
    server_name $PUBLIC_IP;
    ssl_certificate /etc/letsencrypt/live/$PUBLIC_IP/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$PUBLIC_IP/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_cache shared:MM_TLS:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;
    add_header Strict-Transport-Security "max-age=86400" always;
    root /usr/share/nginx/html;
    index index.html index.htm;
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_types text/plain text/css text/xml application/json application/javascript application/xml+rss application/atom+xml image/svg+xml;
    include /etc/nginx/snippets/moss-routes.conf;
}
NGINX
cat > "$tmp/https-redirect.conf" <<'NGINX'
if ($scheme = http) {
    return 301 https://$host$request_uri;
}
NGINX
chmod 0644 "$tmp/https-server.conf" "$tmp/https-redirect.conf"
mv "$tmp/https-server.conf" "$TLS_DIR/https-server.conf"
mv "$tmp/https-redirect.conf" "$TLS_DIR/https-redirect.conf"
changed=true

docker exec moss_marrow_frontend nginx -t
docker exec moss_marrow_frontend nginx -s reload
curl --fail --silent --show-error --max-time 10 --connect-to "$PUBLIC_IP:443:127.0.0.1:443" "https://$PUBLIC_IP/" | grep -q 'id="root"'
curl --fail --silent --show-error --max-time 10 --connect-to "$PUBLIC_IP:443:127.0.0.1:443" "https://$PUBLIC_IP/api/v1/health" | grep -q '"status":"ok"'

install -o root -g root -m 0700 "$(dirname "$0")/renew-certificate.sh" "$RENEW_SCRIPT"
cat > /etc/systemd/system/moss-marrow-certbot-renew.service <<'UNIT'
[Unit]
Description=Renew MOSS & MARROW short-lived Let's Encrypt IP certificate
After=docker.service
Requires=docker.service
[Service]
Type=oneshot
ExecStart=/usr/local/sbin/moss-marrow-renew-certificate
UNIT
cat > /etc/systemd/system/moss-marrow-certbot-renew.timer <<'UNIT'
[Unit]
Description=Check MOSS & MARROW certificate renewal every six hours
[Timer]
OnBootSec=5min
OnUnitActiveSec=6h
RandomizedDelaySec=30min
Persistent=true
[Install]
WantedBy=timers.target
UNIT
chmod 0644 /etc/systemd/system/moss-marrow-certbot-renew.service /etc/systemd/system/moss-marrow-certbot-renew.timer
systemctl daemon-reload
systemctl enable --now moss-marrow-certbot-renew.timer

changed=false
trap - EXIT
rm -rf -- "$tmp"
echo 'HTTPS enabled; local HTTPS frontend and API checks passed.'
