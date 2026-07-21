# Deploying Deevale GH

The frontend and backend are deployed separately:

| Piece | Where | Hostname |
|---|---|---|
| React SPA | Vercel (static) | `app.deevalegh.com` |
| Flask API, Celery, Postgres, Redis, MinIO | One Ubuntu VPS, Docker Compose | `api.deevalegh.com` |

They are **different origins**, so the browser talks to the API cross-origin.
That works because auth is Bearer-token based, not cookie based — but it means
`CORS_ORIGINS` on the API must list the exact frontend origin or every request
fails in the browser while working fine from curl.

> **All-in-one alternative.** If you would rather run everything on the VPS
> under one hostname, `frontend/Dockerfile` + `frontend/nginx.conf` still do
> that: nginx serves the bundle and proxies `/api/` and `/socket.io/` to Flask
> on the same origin. Re-add the `web` service to `docker-compose.prod.yml`,
> skip the Vercel section, and note that API paths then gain an `/api` prefix.
> Everything below assumes the split deploy.

---

## Part 1 — Backend on the VPS

### 1. Server prep

2 GB RAM minimum (WeasyPrint and the Node-free API image are the floor; 4 GB
if you also run backups on the box).

```bash
apt update && apt install -y docker.io docker-compose-v2 caddy
```

Point a DNS `A` record for `api.deevalegh.com` at the server.

### 2. Clone and configure

```bash
git clone https://github.com/kwansodan/deevalegh.git /opt/deevalegh
cd /opt/deevalegh
cp .env.example .env
```

Edit `.env` and set **real values** — every secret comes from here, never from
code:

- `SECRET_KEY`, `JWT_SECRET_KEY` — long random strings (`openssl rand -hex 32`)
- `POSTGRES_USER`, `POSTGRES_PASSWORD`
- `S3_ACCESS_KEY`, `S3_SECRET_KEY` — MinIO root credentials
- `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY` — **live** keys
- `RESEND_API_KEY`, `EMAIL_SENDER=resend`, `EMAIL_FROM_ADDRESS`
- `CORS_ORIGINS=https://app.deevalegh.com`

> ⚠️ **`CORS_ORIGINS` order is load-bearing.** The first entry doubles as the
> public frontend base URL when generating invoice payment links
> (`app/bookkeeping/tasks.py`) and referral / co-founder links
> (`app/referrals/routes.py`). If you put a preview or localhost origin first,
> clients get emailed broken links. Production origin goes first, always.

### 3. Build and start

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Six services come up: `postgres`, `redis`, `minio`, `api`, `worker`, `beat` —
plus a one-shot `migrate` that runs `flask db upgrade` and exits. `api`,
`worker` and `beat` all wait on it via `service_completed_successfully`, so a
failed migration means nothing starts on a schema it cannot use. Migrations
therefore need no manual step on any deploy or redeploy.

> ⚠️ `migrate` fails immediately if `migrations/versions/` is empty of a real
> initial revision, or if `ProdConfig.validate()` rejects a default secret. Both
> are intentional: better a stack that refuses to start than an API returning
> 500s because no tables exist.

First boot only — seed the reference data:

```bash
docker compose -f docker-compose.prod.yml exec api python -m seeds.seed_roles
docker compose -f docker-compose.prod.yml exec api python -m seeds.seed_fee_schedule
docker compose -f docker-compose.prod.yml exec api python -m seeds.seed_workflow_definitions
```

### Running it from Komodo

Point the stack at `docker-compose.prod.yml`, **not** `docker-compose.yml`. The
dev file contains only backing services plus Mailhog and no application at all;
deploying it gives you four healthy containers and nothing serving the API.

Build Path is the repo root (`.`) and Dockerfile Path is `Dockerfile` — the
image `COPY`s `app/`, `migrations/`, `seeds/` and the wsgi/celery entrypoints,
all of which live at the root. One build serves `migrate`, `api`, `worker` and
`beat`; they differ only by `command`.

Then replace the seeded fee amounts with the real current government fees via
the admin UI (`/ops/settings`) — the seeded figures are placeholders.

### 4. TLS with Caddy

`/etc/caddy/Caddyfile`:

```
api.deevalegh.com {
    reverse_proxy 127.0.0.1:8000
}
```

```bash
systemctl reload caddy
```

Caddy provisions and renews Let's Encrypt certificates automatically, and
proxies WebSocket upgrades for `/socket.io/` without extra configuration. The
API container binds to `127.0.0.1:8000`, so it is only reachable through Caddy.

Verify before touching the frontend:

```bash
curl https://api.deevalegh.com/health
```

### 5. Paystack webhook

```
https://api.deevalegh.com/payments/webhook/paystack
```

> Note the **absence of an `/api` prefix**. Blueprints are mounted at the root;
> the old prefix existed only because the nginx container rewrote `/api/` →
> `/`. In the split deploy the browser and Paystack hit Flask directly.

---

## Part 2 — Frontend on Vercel

Import the GitHub repo at vercel.com, then:

- **Root Directory**: `frontend` (the repo root is Python)
- Uncheck "Include source files outside of the Root Directory"
- Framework preset: **Vite** — build command and output dir come from
  `frontend/vercel.json`

Environment variables (Production **and** Preview):

| Key | Value |
|---|---|
| `VITE_API_BASE_URL` | `https://api.deevalegh.com` |
| `VITE_SOCKET_URL` | `https://api.deevalegh.com` |

These are **baked into the bundle at build time**, so changing one needs a
redeploy, not a restart. They are also readable by anyone who opens devtools —
never put a secret behind a `VITE_` prefix.

Add `app.deevalegh.com` under Domains and point the CNAME.

`frontend/vercel.json` supplies the SPA catch-all rewrite (so deep links and
the public `/pay/:token` and `/sign/:token` pages survive a hard refresh) and
sets `sw.js` to revalidate, so the auto-updating service worker is never
pinned to a stale shell by the CDN.

---

## Operations

- **Logs**: `docker compose -f docker-compose.prod.yml logs -f api worker`
- **Update**: `git pull && docker compose -f docker-compose.prod.yml up -d --build`
- **DB backup**: `docker compose -f docker-compose.prod.yml exec postgres pg_dump -U $POSTGRES_USER deevalegh > backup.sql`
- **MinIO bucket policy**: the documents bucket is private; all client access
  goes through short-lived presigned URLs issued by the API. Never attach a
  public-read policy to it.

### Socket.IO and worker count

`app/extensions.py` runs Socket.IO in `threading` mode. Two things keep that
safe across the 4 gunicorn workers in `Dockerfile`:

1. `message_queue` is set to Redis, so an event emitted by one worker reaches
   clients connected to any other.
2. `simple-websocket` is installed, so clients get a real WebSocket — one
   persistent connection pinned to one worker.

If you remove `simple-websocket`, Socket.IO silently falls back to HTTP
long-polling, where consecutive polls land on different workers and the
session breaks. In that case you must drop to one worker or configure sticky
sessions in Caddy.
