# Deploying LaunchGH to a single VPS

Target: one Ubuntu VPS (DigitalOcean / Hetzner, 2 GB RAM minimum) running
Docker Compose, with Caddy terminating TLS in front of the stack.

## 1. Server prep

```bash
apt update && apt install -y docker.io docker-compose-v2 caddy
```

Point your DNS `A` record (e.g. `app.launchgh.com`) at the server.

## 2. Clone and configure

```bash
git clone <your-repo> /opt/launchgh && cd /opt/launchgh
cp .env.example .env
```

Edit `.env` and set **real values** — every secret must come from here, never
from code:

- `SECRET_KEY`, `JWT_SECRET_KEY` — long random strings (`openssl rand -hex 32`)
- `POSTGRES_USER`, `POSTGRES_PASSWORD`
- `S3_ACCESS_KEY`, `S3_SECRET_KEY` — MinIO root credentials
- `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY` — **live** keys from the Paystack dashboard
- `SENDGRID_API_KEY`, `EMAIL_SENDER=sendgrid`, `EMAIL_FROM_ADDRESS`
- `CORS_ORIGINS=https://app.launchgh.com`

## 3. Build and start

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

First boot only — run migrations and seed the workflow/fee data:

```bash
docker compose -f docker-compose.prod.yml exec api flask --app wsgi db upgrade
docker compose -f docker-compose.prod.yml exec api python -m seeds.seed_roles
docker compose -f docker-compose.prod.yml exec api python -m seeds.seed_fee_schedule
docker compose -f docker-compose.prod.yml exec api python -m seeds.seed_workflow_definitions
```

Then update the fee schedule amounts with the real current government fees via
the admin UI (`/ops/settings`) — the seeded figures are placeholders.

## 4. TLS with Caddy

`/etc/caddy/Caddyfile`:

```
app.launchgh.com {
    reverse_proxy 127.0.0.1:8080
}
```

```bash
systemctl reload caddy
```

Caddy provisions and renews Let's Encrypt certificates automatically. The
`web` container serves the SPA and proxies `/api/` + `/socket.io/` to Flask
internally, so only port 8080 (bound to localhost) needs exposing to Caddy.

## 5. Paystack webhook

In the Paystack dashboard set the webhook URL to:

```
https://app.launchgh.com/api/payments/webhook/paystack
```

## 6. Operations

- **Logs**: `docker compose -f docker-compose.prod.yml logs -f api worker`
- **Update**: `git pull && docker compose -f docker-compose.prod.yml up -d --build`
- **DB backup**: `docker compose -f docker-compose.prod.yml exec postgres pg_dump -U $POSTGRES_USER launchgh > backup.sql`
- **MinIO bucket policy**: the documents bucket is private by default; all
  client access goes through short-lived presigned URLs issued by the API.
  Never attach a public-read policy to it.
