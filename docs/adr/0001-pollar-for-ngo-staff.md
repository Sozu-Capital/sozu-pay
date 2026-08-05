# Pollar for NGO staff identity and org treasury

NGO staff auth and disbursement signing were passkey-first (with PIN as an incomplete fallback). That model is hard for non-crypto-native distribution operators and left PIN signing unfinished. We adopt **Pollar** for NGO **Pollar login** (Google-only in v1) and a server-provisioned **Org treasury wallet** per NGO; dashboard sessions stay SozuPay-owned, spends are role-gated with **Disbursement confirmation** (no passkey ceremony). Merchants remain on passkey/PIN until a separate initiative. Rejected: Pollar as login-only (still forces passkey at payout), per-user spending wallets, dual-run migration (test accounts only — clean break), and bundling SumUp/MercadoPago card rails into this cutover.

## Addendum — Spike: Pollar server-spend (2026-08-05)

**Verdict: NO-GO (fallback)** — SozuPay cannot independently move funds from an org-scoped Pollar custodial wallet using only a secret API key. Ticket #7 must implement **creator-bound Staff Pollar identity wallet + in-app approval queue**.

### Evidence

1. **Security model (authoritative)** — Pollar docs state the server may sign fee-bumps and sponsorship sequences only; “Move a user's own funds independently: **No**.” Sponsor keys cannot authorize inner `payment` ops. See [Security Model](https://docs.pollar.xyz/docs/core-concepts/security-model).
2. **Live spend probe** — `POST https://sdk.api.pollar.xyz/v2/tx/build-sign-submit` (custodial payment path used by `runTx`):
   - `x-pollar-api-key: sec_testnet_*` → **HTTP 403** `API_KEY_TYPE_NOT_ALLOWED`
   - `x-pollar-api-key: pub_testnet_*` (invalid) → **HTTP 401** `API_KEY_NOT_FOUND` (publishable keys are the only type accepted on this route; a real spend still requires an authenticated end-user DPoP session, not a backend secret alone)
3. **Server API surface** — Documented secret-key ops (`POST /v1/users/with-wallet`, `POST /v1/wallets/activate`, trustlines, `POST /v1/tokens/verify`) cover provision / activate / verify — **not** payment. Documented base `https://api.pollar.xyz` returned **404** for those routes from this environment (2026-08-05); sdk-api health is live at `https://sdk.api.pollar.xyz`.
4. **App DISTRIBUTION wallet** — One per Pollar *application*, used for claimable distribution rules — not a per-Organization treasury SozuPay can debit arbitrarily after role checks.

### Chosen path (fallback)

| Concern | Approach |
|--------|----------|
| Org treasury address | Bound to the **creator’s Staff Pollar identity** wallet at org create; persist public key on the Organization |
| Spend authorization | SozuPay session + role + **Disbursement confirmation**; non-owners enqueue; wallet owner approves |
| On-chain execution | Owner’s authenticated Pollar custodial session (`build-sign-submit` / `runTx`) — never SozuPay secret key alone |
| Audit | Acting User recorded in SozuPay audit log |

### Env / Pollar settings required for fallback

| Variable / setting | Purpose |
|--------------------|---------|
| `NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY` (`pub_testnet_` / `pub_mainnet_`) | NGO home Google login + client custodial tx |
| Pollar Dashboard → Domains | Allow SozuPay origins |
| Pollar Dashboard → Auth | Google enabled (v1 only) |
| Pollar Dashboard → Tokens & Trustlines | USDC (or testnet equivalent) enabled for user wallets |
| Pollar Dashboard → Funding / Sponsorship | Funding + gas wallets funded so custodial wallets activate |
| Optional later: `POLLAR_SECRET_KEY` | Only if/when documented server provision/activate hosts work — **not** for payment |

Reproduce probes: `node scripts/pollar-server-spend-spike.mjs`.
