#!/usr/bin/env bash
set -euo pipefail
set +x

readonly PUBLIC_IP_FILE=/etc/moss-marrow/public-ip
readonly CERTBOT_IMAGE=certbot/certbot:v5.10.0
readonly CERT_ROOT=/etc/letsencrypt
readonly WEBROOT=/opt/moss-acme-webroot

[[ -r "$PUBLIC_IP_FILE" ]] || { echo 'HTTPS public IP configuration is missing.' >&2; exit 1; }
PUBLIC_IP=$(<"$PUBLIC_IP_FILE")
[[ "$PUBLIC_IP" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] || { echo 'HTTPS public IP configuration is invalid.' >&2; exit 1; }
[[ -f "$CERT_ROOT/live/$PUBLIC_IP/fullchain.pem" ]] || { echo 'The production certificate has not been issued yet.' >&2; exit 1; }

exec 9>/opt/.moss-certbot-renew.lock
flock -n 9 || { echo 'Certificate renewal is already running.' >&2; exit 1; }
before=$(sha256sum "$CERT_ROOT/live/$PUBLIC_IP/fullchain.pem" | cut -d' ' -f1)
docker run --rm -v "$CERT_ROOT:/etc/letsencrypt" -v "$WEBROOT:/var/www/acme" \
  "$CERTBOT_IMAGE" renew --quiet
after=$(sha256sum "$CERT_ROOT/live/$PUBLIC_IP/fullchain.pem" | cut -d' ' -f1)

if [[ "$before" != "$after" ]]; then
  docker exec moss_marrow_frontend nginx -t
  docker exec moss_marrow_frontend nginx -s reload
  echo 'Renewed certificate and safely reloaded frontend Nginx.'
else
  echo 'Certificate remains current; no Nginx reload was needed.'
fi
