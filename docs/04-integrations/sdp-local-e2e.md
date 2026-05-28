# Local SDP end-to-end test (web wallet)

Use this to validate the full flow before asking to be allowlisted on a production SDP.

## Prerequisites

- Docker, Git, and Go (per [SDP backend](https://github.com/stellar/stellar-disbursement-platform-backend) setup wizard).
- SozuPay dashboard running with env set (see below).

## 1. Run SDP locally

Follow the SDP backend repository’s local setup wizard. Note the tenant base URL and the host that serves `/.well-known/stellar.toml` (this hostname must be listed in **`SDP_ALLOWED_DOMAINS`**).

For HTTP on `localhost`, the app tries `http://` first when fetching `stellar.toml` from local hosts.

### Multi-tenant admin UI (avoid “Tenant not found in context”)

1. Add to `/etc/hosts`: `127.0.0.1 bluecorp.stellar.local redcorp.stellar.local pinkcorp.stellar.local` (see SDP `dev/README.md`).
2. Open the UI at **`http://bluecorp.stellar.local:3000`** (not `http://localhost:3000`).
3. **API URL must use the same tenant hostname.** The bundled `dev/env-config-testnet.js` sets `API_URL` to `http://localhost:8000` by default. Browser calls then hit the API with `Host: localhost`, so the backend cannot resolve a tenant (it uses the `Host` header or `SDP-Tenant-Name`). Change it to match the tenant you use in the browser, for example:

   ```js
   API_URL: "http://bluecorp.stellar.local:8000",
   ```

   Save the file, restart the `sdp-frontend` container (the file is bind-mounted), then hard-refresh the dashboard. Use `owner@bluecorp.local` / `Password123!` unless your DB was seeded differently.

4. Start Compose with your real secrets file, e.g. `docker compose --env-file dev/.env.default ...`, so `SEP10_SIGNING_PUBLIC_KEY` and distribution keys are not blank (otherwise `sdp-api` exits immediately).

5. **Seed tenants in the database.** If you skipped “Initialize tenants and users” in `make setup`, the admin DB has **no** `bluecorp` / `redcorp` / `pinkcorp` rows. The UI will still show “Tenant not found in context” even with correct `API_URL`. Check:

   ```bash
   curl -s -u "SDP-admin:api_key_1234567890" http://127.0.0.1:8003/tenants
   ```

   If you see `[]`, run **`make setup`** again, pick your existing `.env`, start Docker when asked, and answer **Yes** to **Initialize tenants and users**.  
   Defaults match `dev/docker-compose-sdp.yml` (`ADMIN_ACCOUNT` / `ADMIN_API_KEY`); use your values if you changed them.

## 2. Configure SozuCredit (recipient wallet)

For **testnet with deployed wallet** (`credit.sozu.capital`) while SDP stays local, use [sdp-testnet-production-e2e.md](sdp-testnet-production-e2e.md) instead of localhost/ngrok below.

Set at least (local wallet dev only):

```bash
SDP_ALLOWED_DOMAINS=localhost:YOUR_SDP_PORT   # exact host:port from the SDP URL
WALLET_CLIENT_DOMAIN=localhost:3000          # or your tunnel host if SDP cannot reach localhost
SEP10_CLIENT_SIGNING_SECRET=S...               # funded testnet keypair; public is exposed in stellar.toml
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Important:** SDP must be able to request `https://<WALLET_CLIENT_DOMAIN>/.well-known/stellar.toml` (or use a tunnel such as ngrok and set `WALLET_CLIENT_DOMAIN` to the tunnel hostname). If SDP cannot reach your machine, SEP-10 with `client_domain` will fail.

## 3. Seed the wallet in SDP

Insert or configure your wallet with:

- **Deep link schema** = `http://localhost:3000/sdp/invite` (or tunnel URL) — must match how you open the app.
- **SEP-10 client domain** = same host as `WALLET_CLIENT_DOMAIN`.

## 4. Run through the flow

1. Create a test disbursement in SDP and select SozuPay as the wallet.
2. Open the SMS/email link (or copy the registration URL) in a browser.
3. You should hit `/sdp/invite`, get a cookie, then login (use `?sdpInvite=1` flow if redirected to login).
4. Complete `/sdp/register`: SEP-10 sign challenge, open SEP-24 interactive URL, finish verification on SDP UI.
5. Confirm payment / registration status in SDP admin and, if applicable, on Horizon.

## 5. Evidence for a provider request

- Short screen recording: invite link → login → SEP-10 → SEP-24 page.
- Note test network, SDP version or commit, and your public **client domain** + **deep link** used.
- **Testnet transaction hashes** for disbursement payments (see below).

### Testnet transaction hashes (readiness evidence)

Hashes appear in `sdp_bluecorp.payments.stellar_transaction_id` only **after** recipients are registered and SDP/TSS has submitted on-chain payments. Until then, rows stay `READY` with an empty hash.

**Do not delete Docker volumes** if you need to keep an existing disbursement batch. Fix wallet URLs, then **resend invitations** from the SDP UI (same disbursement) so new signed links use the current `deep_link_schema`.

**1. Confirm batch and payments (no reset):**

```bash
docker exec sdp-db-1 psql -U postgres -d sdp_mtn -c "
SELECT d.id, d.name, d.status
FROM sdp_bluecorp.disbursements d
ORDER BY d.created_at DESC LIMIT 5;
"

docker exec sdp-db-1 psql -U postgres -d sdp_mtn -c "
SELECT p.id, r.external_id, p.amount, p.status,
       p.stellar_transaction_id, p.stellar_operation_id
FROM sdp_bluecorp.payments p
JOIN sdp_bluecorp.receivers r ON r.id = p.receiver_id
WHERE p.disbursement_id = '<YOUR_DISBURSEMENT_ID>'
ORDER BY r.external_id;
"
```

**2. Local wallet without ngrok (recommended):**

| Component | Value |
|-----------|--------|
| SozuCredit dev | `pnpm dev -- -H 0.0.0.0 -p 3001` |
| Browser | `http://localhost:3001` (passkeys; not `0.0.0.0`) |
| `WALLET_CLIENT_DOMAIN` (SozuCredit) | `host.docker.internal:3001` |
| SDP wallet **SEP-10 client domain** | `host.docker.internal:3001` |
| SDP wallet **deep link** | `http://host.docker.internal:3001/sdp/invite` |
| `SDP_ALLOWED_DOMAINS` | `bluecorp.stellar.local:8000` |

SDP in Docker must reach the wallet TOML:

```bash
docker exec sdp-sdp-api-1 wget -qO- http://host.docker.internal:3001/.well-known/stellar.toml | head
```

**3. Registration links (DRY_RUN email):**

```bash
docker compose --project-name sdp logs sdp-api 2>&1 | grep "Content: You have a payment" | tail -5
```

Open `http://bluecorp.stellar.local:8000/r/<short_id>` in the browser **after** resending invites (old short URLs still embed the previous ngrok host in the signed query).

**4. E2E steps (per recipient):**

1. Open registration link → SozuCredit `/sdp/invite` → auth (`?sdpInvite=1`) → `/sdp/register`.
2. SEP-10 (passkey) → SEP-24 verification (SDP-hosted UI).
3. In SDP admin: confirm receiver wallet has a **Stellar address** and disbursement can proceed (start / approve per your tenant rules).
4. Re-run the payments query; copy non-null `stellar_transaction_id` values.

**5. Horizon links:**

`https://stellar.expert/explorer/testnet/tx/<stellar_transaction_id>`

or `https://horizon-testnet.stellar.org/transactions/<hash>`

**6. SEP-10 auth tx (optional):** the SEP-10 challenge submission may also appear on Horizon under the user or client signing account; the primary readiness evidence for disbursements is the **payment** row hash above.

## Automated tests

Full SDP in CI is optional. You can add Playwright smoke tests with mocked SEP-10/SEP-24 HTTP if you need regression coverage without Docker SDP.
