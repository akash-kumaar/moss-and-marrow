# Reservation API operational notes

Defaults apply on the single Node process behind the Compose frontend. Each address gets 240 API requests per minute, 12 reservation attempts per ten minutes and 10 enquiry attempts per ten minutes. Shared networks consume one allowance. The ingress also caps simultaneous API requests per client at 32. Fixed windows can burst at boundaries; counters reset on process restart and separate replicas have independent limits. Distributed sources can still overwhelm a single host. Health checks bypass Express quotas. Only the Compose frontend IPv4 resolved through Docker DNS is trusted; until resolution succeeds, clients share the proxy's allowance. Revisit this policy before adding an external proxy.

Backend environment example (all optional):

~~~ini
API_REQUESTS_PER_MINUTE=240
RESERVATIONS_PER_10_MINUTES=12
ENQUIRIES_PER_10_MINUTES=10
TURNSTILE_ENABLED=false
# When enabling, supply all three through the backend container environment:
# TURNSTILE_SITE_KEY=
# TURNSTILE_SECRET_KEY=
# TURNSTILE_HOSTNAME=
~~~

Enable Turnstile only after registering the customer-facing hostname, providing the keys and testing the widget on that origin. The public config endpoint exposes only the site key. The API checks Siteverify success, action, hostname and challenge time for each new booking. Siteverify enforces single-use tokens. On verifier outage, enabled bookings fail with 503. Disabled mode requires no keys or external calls. The current EC2 deploy script builds a temporary backend env file containing only the Mongo URI and JWT secret. Optional overrides must be passed into the actual backend service at rollout; a workstation dotenv file or GitHub repository variable alone does not configure EC2. Deployment with defaults needs no new secrets.

Reservation clients should send a fresh random Idempotency-Key for each intentional booking and reuse it for retries with identical fields. A replay returns the original receipt. A different payload reusing a key returns 409. Legacy clients omitting a key remain supported; identical details alone do not establish that two bookings are the same. Uniqueness and capacity depend on MongoDB indexes; startup waits for them. Older reservations are counted without rewriting them.

The public API has no login or cookie-based admin session. CORS constrains browsers only. Production disables the image candidate tool. The API issues a limited confirmation receipt. Configure Loki retention and access for IP addresses. Restricted-route JSON access logs use normalized endpoint names and omit request bodies and query strings. Suggested initial alerts: 20 or more reservation 429s in five minutes from one IP, at least five 5xx responses and a 5xx ratio above 5% over five minutes, or two consecutive unhealthy container checks. Verify selectors and thresholds against live ingestion. Keep existing incident logs and review reservation counts by time bucket before taking any action on records.

Production publishes port 80. The repository does not provision TLS for the public form. The generated Mongo service has a named volume and no published port, but the deployment spec does not enable Mongo authorization; inspect actual database users and backup/restore readiness before changing access. Backend runs as node; the frontend Nginx master binds port 80 as root. Compose does not specify container memory bounds or log rotation. Retain host monitoring for disk and memory pressure. Previously disclosed Pixabay credentials should be rotated by the account owner.

The single-instance release can interrupt availability during replacement or index creation. The current deployment and backup runbook is [EC2 production deployment and recovery](devops/deployment-guide.md).
