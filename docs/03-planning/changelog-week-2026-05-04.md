# Week changelog — SozuPay dashboard **+** SozuCredit (SDP & wallets)

**Week:** Monday 4 May — Sunday 10 May 2026 (inclusive)  
**Repos:** [sozupay_mvp](https://github.com/blessedux/sozupay_mvp) (SozuPay operator / NGO dashboard — this tree) · [SozuCredit](https://github.com/blessedux/SozuCredit) (recipient wallet, passkeys, Stellar)  
**Format:** Weekly engineering changelog (summary, shipped per repo, architecture, docs, in flight, next) — same spirit as a [Notion week-01 changelog](https://www.notion.so/ArcusX-Week-01-changelog-architecture-359f53fafdf7804a85becaa7f65b2a32); we cannot mirror that page verbatim.

---

## Executive summary

| Repo | On `main` this week | In flight (local / uncommitted) |
|------|---------------------|----------------------------------|
| **sozupay_mvp** (dashboard) | No new merges; branch still **+2** vs `origin/main` from **30 Apr** Privy/Stellar/KYC release. | SDP docs snapshot, **`fetchSdpToml`** HTTP-first for `*.stellar.local`, planning **todo**, optional **SDP backend** clone beside the app. |
| **SozuCredit** | **7 commits:** multicurrency ledger merge + UX, Gmail sync, passkeys on two devices, PIN backup, ledger/Supabase fixes, iOS haptics. | **Full SDP recipient path** (invite, TOML, SEP-10/SEP-24, register UI), root **`middleware`** (`0.0.0.0` → `localhost`, public **`/sdp/invite`**), **`lib/supabase/middleware`** SDP routes + **`/auth?sdpInvite=1` redirect-loop fix**. |

Together, this week advances **ledger + auth hardening on the wallet** while **documenting and wiring the SDP story** across operator docs (dashboard repo) and recipient implementation (SozuCredit, not yet all pushed).

---

## Architecture (cross-repo)

1. **Operator vs recipient**  
   **sozupay_mvp** (this repo) = NGO operator UI (bulk disbursements, org onboarding, Privy). **SozuCredit** = beneficiary wallet: passkeys, Stellar, and (in flight) **SDP deep link → SEP-10 → SEP-24** at `credit.sozu.capital` in production.

2. **Local multi-tenant SDP**  
   Tenant resolution needs **browser `Host`** aligned with SDP **`API_URL`** (e.g. `bluecorp.stellar.local`). Documented in dashboard **`sdp-local-e2e.md`**.

3. **TOML over HTTP in dev**  
   Both apps benefit from trying **`http://` first** for `*.stellar.local` / loopback when loading `/.well-known/stellar.toml` (dashboard: `fetchSdpToml`; SozuCredit carries the same pattern in **`lib/sdp/fetchSdpToml.ts`**).

4. **WebAuthn vs host**  
   SozuCredit **`middleware.ts`**: redirect **`0.0.0.0` → `localhost`** so `rpId` stays valid; users should still open **`http://localhost:<port>`** in the browser for passkeys.

---

## sozupay_mvp (SozuPay dashboard)

**Canonical remote:** [github.com/blessedux/sozupay_mvp](https://github.com/blessedux/sozupay_mvp) (this file lives under `docs/03-planning/`).

### Shipped on `main` (git — before this week)

Nothing merged **during** 4–10 May on the checked-out branch. Recent baseline:

| Date       | Commit   | Summary |
|-----------|----------|---------|
| 2026-04-30 | `a773d71` | Merge `feat/privy-stellar-kyc` → `main` |
| 2026-04-30 | `af4f5dc` | **Release:** onboarding, org wallets, Sozu tags, credit and integrations |

### Documentation & runbooks (uncommitted)

| Path | Change |
|------|--------|
| `docs/04-integrations/sdp-readiness.md` | **New:** SDP-ready snapshot, ACL note, checklist pointers, SozuCredit vs dashboard. |
| `docs/04-integrations/sdp-local-e2e.md` | **Extended:** `/etc/hosts`, `API_URL` / tenant alignment, env-file & keys for `sdp-api`, tenant seeding / `curl /tenants`. |
| `docs/04-integrations/sdp-wallet-operator-checklist.md` | Minor updates. |
| `docs/README.md` | Index / links for SDP docs. |
| `docs/03-planning/todo.md` | **SDP wallet registration** checklist (SozuCredit + partner + evidence). |

### Code (uncommitted)

- **`src/lib/sdp/fetchSdpToml.ts`** — **`stellar.local`**: try **HTTP first**, then HTTPS, for local Docker SDP.
- **`package-lock.json`** — Lockfile drift (review before commit).

### Infrastructure (uncommitted)

- **`stellar-disbursement-platform-backend/`** — Local SDP Docker clone; align **`.gitignore` / submodule** before pushing.

---

## SozuCredit

**Remote:** [github.com/blessedux/SozuCredit](https://github.com/blessedux/SozuCredit) — passkey-first Stellar wallet, ledger, vault workflows (see repo README for product overview).

### Shipped on `main` (4–10 May 2026)

| Date | Commit | Summary |
|------|--------|---------|
| 2026-05-10 | `1b4d3b8` | **feat:** passkeys for two devices, PIN backup auth, smarter Gmail sync |
| 2026-05-09 | `373c507` | **feat(ledger):** iOS-safe tap haptics for nav and summary |
| 2026-05-09 | `fe9499b` | **fix:** allow ledger routes without Supabase session; use `getUserId` for ledger API headers |
| 2026-05-06 | `46b4669` | **fix:** restore Vercel build and align ledger goals store types |
| 2026-05-06 | `910eb04` | **Merge** `feature/email-ledger-multicurrency` |
| 2026-05-06 | `0bfc998` | **feat:** improve ledger transaction editing responsiveness and UX |
| 2026-05-06 | `5136555` | **feat:** ship multicurrency ledger and wallet/vault workflow updates |

### In flight — Stellar Disbursement Platform (recipient) — **not yet on `main`**

New or heavily touched areas in the working tree:

- **Entry & contract**  
  - `app/sdp/invite/route.ts` — signed invite validation, allowlist, cookie + redirect to auth or register.  
  - `app/sdp/register/page.tsx` + `components/SdpRegisterFlow.tsx` — SEP-10 (passkey sign), SEP-24 deposit, status poll.  
  - `app/.well-known/stellar.toml/route.ts` — SEP-10 client domain TOML.

- **API proxies**  
  - `app/api/sdp/sep10/challenge`, `token`  
  - `app/api/sdp/sep24/deposit`, `transactions`, `info`

- **Shared SDP lib**  
  - `lib/sdp/*` — TOML fetch, invite payload, JWT cookie, SEP-10/SEP-24 server helpers, allowlist, SDP API context.

- **Auth plumbing**  
  - `lib/supabase/authCookies.ts` — detect SSR auth cookies for middleware decisions.  
  - `lib/supabase/middleware.ts` — allow **`/sdp/register`** without forcing Supabase-only gate; **do not** server-redirect **`/auth?sdpInvite=1`** to `/wallet` when session cookies exist but passkey wallet state may not (fixes **ERR_TOO_MANY_REDIRECTS** with SDP link).  
  - `middleware.ts` — **`0.0.0.0` → `localhost`**; passthrough **`/sdp/invite`** before session refresh.  
  - `app/auth/page.tsx`, `.env.example` — SDP invite query param and env documentation.

---

## Risks & blockers

- **Two repos, one product story** — SDP operator docs on the dashboard can drift from SozuCredit until both are committed and linked from release notes.
- **SozuCredit SDP bundle unpushed** — E2E with Docker SDP should be re-run after merge; keep disbursement DB volumes if you must preserve batches.
- **Dashboard `fetchSdpToml` + docs** still unmerged — same drift risk for anyone on `main` only.
- **SDP `client_domain` / tunnels** — HTML interstitials (e.g. some ngrok flows) break TOML decode in SEP-10; prefer **`host.docker.internal`** + wallet on host where possible.

---

## Next week (suggested)

1. **SozuCredit:** Open PR — SDP routes + middleware + `.env.example`; CI / Vercel green; merge then tag if you cut releases from `main`.
2. **sozupay_mvp:** PR — `fetchSdpToml` + SDP docs + `todo`; ignore or submodule **SDP backend** explicitly.
3. **Joint:** One Notion (or internal) page linking **both** PRs + short **invite → auth → register → SEP-24** recording for partners.
4. **Production SozuCredit env** — `SDP_ALLOWED_DOMAINS`, `WALLET_CLIENT_DOMAIN`, `SEP10_CLIENT_SIGNING_SECRET`, `AUTH_SECRET` per [sdp-readiness.md](../04-integrations/sdp-readiness.md).

---

## Regenerate “commits this week”

**Dashboard**

```bash
cd /path/to/sozupay_mvp   # local clone path may differ, e.g. SozuPay_dashboard
git fetch origin
git log origin/main..HEAD --oneline
git log --since="2026-05-04" --until="2026-05-11" --pretty=format:"%h %ad %s" --date=short
```

**SozuCredit**

```bash
cd /path/to/SozuCredit
git fetch origin
git log main --since="2026-05-04" --until="2026-05-11" --pretty=format:"%h %ad %s" --date=short
git status -sb
```

If either week range returns nothing, widen `--since` or record **working tree** / **open PRs** as in-flight work (as with SDP on SozuCredit above).
