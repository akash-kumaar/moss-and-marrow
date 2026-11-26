# HTTPS for the EC2 IPv4 address

## Architecture

The production Compose specification is generated on the EC2 host by `scripts/deploy.sh` as `/opt/docker-compose.deploy.yml`; `docker-compose.yml` is local development only. The frontend Nginx container owns public ports 80 and 443. The backend and MongoDB remain private on the existing Compose network. Let’s Encrypt HTTP-01 files are served from `/opt/moss-acme-webroot`; certificates and Certbot account state persist under `/etc/letsencrypt`. `/opt/moss-tls` contains host-managed Nginx include files. All three host paths are mounted into the frontend, so regular immutable image releases keep HTTPS configuration and certs.

Certbot runs in the official `certbot/certbot:v5.10.0` container. IP-address issuance requires Certbot 5.4+ with `--ip-address`, the `shortlived` profile and HTTP-01. Let’s Encrypt IP certificates last 160 hours, so the systemd timer checks renewal every six hours with randomized delay. Nginx is tested and gracefully reloaded only when the certificate changes. Staging account/state is isolated under `/opt/moss-certbot-staging`.

## Repository and live-state discrepancy

The repository Terraform currently allows inbound TCP/80 only; this change adds TCP/443. The attached task says the live security group already permits 443, but AWS read-only inspection was unavailable during implementation, so the live rule could not be confirmed. The repository also has no Terraform Elastic IP resource/association. The supplied address is `13.204.246.90`; the setup script checks EC2 IMDS and refuses to request a certificate unless that exact address is attached to the target instance.

The EC2 cloud-init embeds `scripts/deploy.sh`, and Terraform sets `user_data_replace_on_change = true`. Do not apply a change that replaces the instance. Install the versioned host deploy script through the approved SSM procedure, validate the Terraform plan contains no instance replacement, and apply only the HTTPS ingress change if the live security group does not already permit 443. Do not allocate a new Elastic IP. Verify the existing allocation remains associated with the production instance.

## Rollout order (not performed by this change)

1. Confirm `13.204.246.90` is the current Elastic IP associated with the production instance and inbound TCP/80 and TCP/443 reach it. Keep port 80 open for HTTP-01.
2. Review a Terraform plan. If inbound 443 is missing, apply only the security-group ingress update. Reject any plan that replaces the EC2 instance, changes its user data, or allocates/releases an address.
3. Run the frontend production build and Nginx/container validations. Release and merge through the existing security-gated GitHub Actions/ECR/SSM pipeline; do not bypass immutable digests or rollback checks.
4. Install the matching `scripts/deploy.sh` on the existing EC2 host through the approved SSM path before its matching release runs. The release artifact checksum must match `/opt/deploy.sh`; do not edit it directly without updating/validating the checksum.
5. Deploy the HTTPS-capable frontend. It keeps HTTP active, publishes 443, mounts the persistent host paths, and serves the ACME webroot. It does not redirect traffic until a trusted certificate is installed.
6. Through an approved root SSM operator session, install `scripts/setup-https.sh` and `scripts/renew-certificate.sh` together in a private temporary host directory and run `setup-https.sh 13.204.246.90`. The script verifies the instance public IP and mounts, probes the live challenge webroot, completes a staging issuance, obtains the production certificate, validates/reloads Nginx and enables the renewal timer. It aborts before issuance if preconditions do not match.
7. From outside AWS, verify HTTP redirects to HTTPS (except `/.well-known/acme-challenge/`), the browser trusts `https://13.204.246.90`, `/api/v1/health` returns healthy through HTTPS, menu/reservation/enquiry pages work, and MongoDB/backend remain healthy. Check `systemctl list-timers moss-marrow-certbot-renew.timer`, `systemctl status moss-marrow-certbot-renew.timer`, and `journalctl -u moss-marrow-certbot-renew.service`.

The initial certificate and HTTPS activation require production host changes and certificate issuance, so they were intentionally not run from this implementation task. Do not claim HTTPS is live until external certificate and endpoint verification succeeds.

## Rollback

If staging or production issuance fails, HTTP remains active and no redirect is enabled. If generated Nginx configuration fails validation or local HTTPS health checks fail, the setup script restores the previous include files and reloads the previous working configuration. To disable HTTPS after a successful activation, use an approved SSM session to empty `/opt/moss-tls/https-redirect.conf` and `/opt/moss-tls/https-server.conf`, run `docker exec moss_marrow_frontend nginx -t`, then `docker exec moss_marrow_frontend nginx -s reload`; verify HTTP and disable the renewal timer. Preserve `/etc/letsencrypt` until rollback and owner-login needs are reviewed. Never delete MongoDB data or its named volume.

## Costs and limits

Let’s Encrypt certificates are free. No load balancer, NAT gateway or other AWS resource is introduced. Existing EC2, data transfer and EBS costs are unchanged. The brief Certbot image pull uses outbound bandwidth. A 160-hour certificate requires a functioning timer, Docker, outbound HTTPS and inbound port 80; monitor timer/service failures and certificate expiry.
