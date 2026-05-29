# SDP on Railway — testnet deploy runbook

Deploy the Stellar Disbursement Platform backend on Railway so the SozuPay Dashboard can create batch disbursements without running a local Docker stack.

---

## Architecture recap

```
Vercel                     Railway                       Stellar testnet
─────────                  ───────                       ───────────────
SozuPay Dashboard ───API──▶ sdp-api (port 8000)
SozuCredit       ◀─invite─  sdp-api            ──submit──▶ Horizon testnet
                            sdp-tss (TSS)
                            PostgreSQL (plugin)
```

---

## Prerequisites

- [Railway](https://railway.app) account
- `railway` CLI: `npm install -g @railway/cli` then `railway login`
- Testnet keypairs (funded via [Friendbot](https://laboratory.stellar.org/#account-creator?network=test)):
  - **SEP-10 signing keypair** (`SEP10_SIGNING_PUBLIC_KEY` / `SEP10_SIGNING_PRIVATE_KEY`)
  - **Distribution keypair** (`DISTRIBUTION_PUBLIC_KEY` / `DISTRIBUTION_SEED`) — must hold USDC trustline + testnet USDC

---

## Step 1 — Create Railway project

```bash
railway init --name sdp-testnet
```

Or create manually at https://railway.app/new.

---

## Step 2 — Add PostgreSQL plugin

In the Railway dashboard for your project:
1. Click **+ New** → **Database** → **PostgreSQL**.
2. Note the connection details — Railway exposes `DATABASE_PUBLIC_URL` (for migrations outside Railway) and `DATABASE_URL` (internal, used by services).

---

## Step 3 — Deploy sdp-api service

Add a new service using the official SDP Docker image:

```bash
# In your Railway project directory
railway add --service sdp-api
```

Set the service image to `stellar/sdp-v2:latest` (or pin a specific tag from [Docker Hub](https://hub.docker.com/r/stellar/sdp-v2/tags)).

### Required environment variables

Set these in the Railway service settings (**Variables** tab):

```bash
# Network
BASE_URL=https://<your-sdp-api-railway-url>        # public URL Railway assigns
HORIZON_URL=https://horizon-testnet.stellar.org
NETWORK_PASSPHRASE=Test SDF Network ; September 2015
ENVIRONMENT=testnet

# Database (use Railway's internal reference variable)
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Multi-tenant
ADMIN_ACCOUNT=SDP-admin
ADMIN_API_KEY=<generate-a-strong-random-key>
SINGLE_TENANT_MODE=true
INSTANCE_NAME=SozuPay SDP testnet

# SEP-10 signing
SEP10_SIGNING_PUBLIC_KEY=<your-sep10-public-key>
SEP10_SIGNING_PRIVATE_KEY=<your-sep10-private-key>
SEP10_CLIENT_ATTRIBUTION_REQUIRED=true

# Distribution wallet (holds USDC, signs payments)
DISTRIBUTION_PUBLIC_KEY=<your-distribution-public-key>
DISTRIBUTION_SEED=<your-distribution-secret>
DISTRIBUTION_ACCOUNT_ENCRYPTION_PASSPHRASE=<random-32-char-passphrase>
CHANNEL_ACCOUNT_ENCRYPTION_PASSPHRASE=<random-32-char-passphrase>

# Messaging — use DRY_RUN initially; dashboard sends Resend invites
EMAIL_SENDER_TYPE=DRY_RUN
SMS_SENDER_TYPE=DRY_RUN

# Security
EC256_PRIVATE_KEY=<generate-EC256-P256-private-key>
SEP24_JWT_SECRET=<random-32-char-secret>
DISABLE_MFA=true
DISABLE_RECAPTCHA=true
CORS_ALLOWED_ORIGINS=https://sozupay-dashboard.vercel.app,https://credit.sozu.capital

# Ports (Railway sets PORT automatically; override if needed)
PORT=8000
ADMIN_PORT=8003
METRICS_PORT=8002

# Scheduler (faster polling for testnet)
SCHEDULER_RECEIVER_INVITATION_JOB_SECONDS=10
SCHEDULER_PAYMENT_JOB_SECONDS=10
```

> **EC256 key generation:** `openssl ecparam -name prime256v1 -genkey -noout -out ec256.pem && cat ec256.pem`

### Start command

```bash
./stellar-disbursement-platform serve
```

(This is the default CMD in the Docker image.)

---

## Step 4 — Deploy sdp-tss service (Transaction Submission Service)

Add a second service using the same image:

```bash
railway add --service sdp-tss
```

Share the same environment variables as `sdp-api`, then add:

```bash
# Override the start command to run TSS instead of the API
# Set in Railway service settings → "Custom Start Command"
```

Custom start command for sdp-tss:
```bash
./stellar-disbursement-platform tss
```

The TSS needs the same `DATABASE_URL`, network, and keypair env vars as sdp-api.

---

## Step 5 — Run database migrations

From your local machine (using the Railway public Postgres URL):

```bash
# Get the public DB URL
railway connect Postgres

# Or use the DATABASE_PUBLIC_URL directly
DATABASE_URL="<railway-public-db-url>" \
  docker run --rm \
  -e DATABASE_URL="<railway-public-db-url>" \
  stellar/sdp-v2:latest \
  ./stellar-disbursement-platform db admin migrate up
```

Alternatively, run migrations via the Railway CLI:

```bash
railway run --service sdp-api -- ./stellar-disbursement-platform db admin migrate up
```

---

## Step 6 — Create a tenant

Use the SDP admin API (port 8003, or Railway exposes it via the same domain on path `/admin`):

```bash
SDP_ADMIN_URL=https://<your-sdp-api-railway-url>

# Create tenant
curl -X POST "${SDP_ADMIN_URL}/admin/tenants" \
  -H "SDP-Tenant-Name: admin" \
  -u "SDP-admin:<ADMIN_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "mujeres2000",
    "organization_name": "Mujeres 2000",
    "base_url": "'"${SDP_ADMIN_URL}"'",
    "sdp_ui_base_url": "https://sozupay-dashboard.vercel.app",
    "owner_email": "<your-ngo-admin@email.com>",
    "owner_first_name": "NGO",
    "owner_last_name": "Admin",
    "distribution_account_type": "DISTRIBUTION_ACCOUNT.STELLAR.DB_VAULT"
  }'
```

Record the `id` and note the owner receives a password-set email (or set it manually via the SDP UI).

---

## Step 7 — Run tenant migrations

```bash
railway run --service sdp-api -- \
  ./stellar-disbursement-platform db migrate up \
  --tenant-id <tenant-id-from-above>
```

---

## Step 8 — Register SozuCredit wallet in SDP

Log in as the tenant owner (via SDP admin UI at `https://<sdp-url>`) or via the API:

```bash
# Authenticate as tenant owner
TOKEN=$(curl -s -X POST "${SDP_ADMIN_URL}/auth/login" \
  -H "SDP-Tenant-Name: mujeres2000" \
  -H "Content-Type: application/json" \
  -d '{"email":"<owner-email>","password":"<owner-password>"}' \
  | jq -r '.token')

# Register SozuCredit wallet
curl -X POST "${SDP_ADMIN_URL}/wallets" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "SDP-Tenant-Name: mujeres2000" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "SozuCredit",
    "homepage": "https://credit.sozu.capital",
    "sep_10_client_domain": "credit.sozu.capital",
    "deep_link_schema": "https://credit.sozu.capital/sdp/invite",
    "assets": [{"code": "USDC", "issuer": "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"}]
  }'
```

Note the wallet `id` returned — you will need it when creating disbursements from the dashboard.

---

## Step 9 — Preflight check

```bash
# Health endpoint
curl -fsS "https://<sdp-api-url>/health"

# Tenant health (requires tenant header)
curl -fsS "https://<sdp-api-url>/health" \
  -H "SDP-Tenant-Name: mujeres2000"

# SozuCredit TOML still reachable
./scripts/sdp-preflight.sh credit.sozu.capital
```

---

## Step 10 — Configure the SozuPay Dashboard (Vercel env)

Add these to your Vercel project environment variables:

```bash
SDP_API_URL=https://<sdp-api-railway-url>
SDP_TENANT_NAME=mujeres-admin
SDP_ADMIN_EMAIL=<owner-email>
SDP_ADMIN_PASSWORD=<owner-password>
SOZUCREDIT_URL=https://credit.sozu.capital
RESEND_API_KEY=<your-resend-key>
SDP_INVITE_EMAIL_FROM=Sozu Credit <invites@yourdomain.com>
```

---

## Step 11 — Configure SozuCredit allowlist (Vercel)

Add the Railway SDP hostname to SozuCredit's allowed domains so SEP-10 client attribution works:

```bash
SDP_ALLOWED_DOMAINS=<sdp-api-railway-hostname>:443,<sdp-api-railway-hostname>
```

Redeploy SozuCredit, then re-run the preflight script.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `sdp-api` crashes on startup | Missing required env var | Check Railway logs; compare against env table above |
| `401 Unauthorized` from dashboard | Wrong `SDP_ADMIN_EMAIL` / `SDP_ADMIN_PASSWORD` | Log in to SDP UI directly to verify creds |
| `502` on disbursement create | SDP API unreachable | Verify `SDP_API_URL` has no trailing `/`; check Railway service is deployed |
| Payments stuck in `PENDING` | TSS not running or not funded | Check sdp-tss service logs; fund distribution wallet on Friendbot |
| SozuCredit 503 on TOML | `SEP10_CLIENT_SIGNING_SECRET` not set | Verify Vercel env on SozuCredit project; redeploy |
| Recipient wallet registration 500: `Failed to load tenant by name` | JWT `home_domain` is a flat Railway URL; SDP parses the first subdomain as tenant name (`sdp-v2-production-f6c7`, not `mujeres-admin`) | Set `SINGLE_TENANT_MODE=true` when you have one tenant on a flat hostname, **or** set tenant `base_url` to `https://<tenant-name>.your-domain` with matching DNS |
| Tenant schema missing (rare after create) | Step 7 tenant migrations not run | `railway run --service sdp-api -- ./stellar-disbursement-platform db migrate up --tenant-id <uuid>` |
| `Tenant not found in context` on dashboard SDP calls | Wrong `SDP_TENANT_NAME` | Must match tenant `name` from Railway setup (probe: `POST /login` with header should return "Incorrect email or password", not "Tenant not found") |

---

## Reference

- [Stellar SDP docs](https://developers.stellar.org/docs/platforms/stellar-disbursement-platform)
- [SDP OpenAPI spec](https://raw.githubusercontent.com/stellar/stellar-docs/refs/heads/main/openapi/stellar-disbursement-platform/bundled.yaml)
- [Docker Hub: stellar/sdp-v2](https://hub.docker.com/r/stellar/sdp-v2/tags)
- [SozuCredit wallet operator checklist](sdp-wallet-operator-checklist.md)
- [Local E2E test guide](sdp-local-e2e.md)
