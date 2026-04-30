# SDP operator checklist — allowlisting SozuPay (web wallet)

Use this when an SDP administrator seeds your wallet or when you submit details to Stellar / a disbursement partner.

## Values to provide

| Field | Example | Notes |
|--------|---------|--------|
| **Name** | SozuPay | Display name in SDP UI. |
| **Homepage** | `https://your-product-domain` | Marketing or product URL. |
| **SEP-10 client domain** | `app.yourdomain.com` | Hostname only, no `https://`. Must match the `Host` header when SDP fetches `https://<client_domain>/.well-known/stellar.toml`. In development with a tunnel, use the tunnel hostname. |
| **Deep link schema** | `https://app.yourdomain.com/sdp/invite` | Full HTTPS URL prefix for registration links. SDP appends query parameters (`asset`, `domain`, `name`, `signature`, optional `token`). The path must match production (default in app: `/sdp/invite`, overridable via `SDP_INVITE_PATHNAME`). |

## Server environment (your deployment)

- **`SDP_ALLOWED_DOMAINS`** — Comma-separated list of SDP hostnames whose `stellar.toml` this wallet may fetch (SSRF protection). Include every SDP tenant host you support (e.g. `sdp.partner.com`, or `localhost:8080` for local Docker SDP).
- **`WALLET_CLIENT_DOMAIN`** — Same hostname as **SEP-10 client domain** (what you gave the operator).
- **`SEP10_CLIENT_SIGNING_SECRET`** — Stellar secret key whose public key is published in your `/.well-known/stellar.toml` as `SIGNING_KEY`. Used only to add the SEP-10 client-domain signature; keep server-only.
- **`AUTH_SECRET`** — Already required for sessions; also used to sign the short-lived disbursement invite cookie.

## References

- [Making Your Wallet SDP-Ready](https://developers.stellar.org/docs/platforms/stellar-disbursement-platform/admin-guide/making-your-wallet-sdp-ready)
- [SDP registration API](https://developers.stellar.org/docs/platforms/stellar-disbursement-platform/api-reference/registration)
