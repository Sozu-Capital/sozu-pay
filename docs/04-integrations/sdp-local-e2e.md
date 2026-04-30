# Local SDP end-to-end test (web wallet)

Use this to validate the full flow before asking to be allowlisted on a production SDP.

## Prerequisites

- Docker, Git, and Go (per [SDP backend](https://github.com/stellar/stellar-disbursement-platform-backend) setup wizard).
- SozuPay dashboard running with env set (see below).

## 1. Run SDP locally

Follow the SDP backend repository’s local setup wizard. Note the tenant base URL and the host that serves `/.well-known/stellar.toml` (this hostname must be listed in **`SDP_ALLOWED_DOMAINS`**).

For HTTP on `localhost`, the app tries `http://` first when fetching `stellar.toml` from local hosts.

## 2. Configure SozuPay

Set at least:

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

## Automated tests

Full SDP in CI is optional. You can add Playwright smoke tests with mocked SEP-10/SEP-24 HTTP if you need regression coverage without Docker SDP.
