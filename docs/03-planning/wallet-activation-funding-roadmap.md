# Wallet activation & XLM funding roadmap

**Context:** How new accounts get XLM today, and options to move to automatic wallet funding (Friendbot vs proprietary middleware) plus USDC trustline.

---

## Current state

### XLM activation

**Manual (admin-triggered) flow (still used for non–pre-invited users):**

1. User registers wallet (G or C) via Profile → signs message, we store `stellar_public_key` and optionally `stellar_smart_account_address`.
2. User clicks **“Request activation”** → we set `activation_requested_at` (and optionally `activation_requested_org_id`).
3. **Super-admin** goes to **Admin** → “Pending activation requests” → clicks **“Activate”** per user.
4. Backend `POST /api/admin/activate-user`:
   - Sets `allowed = true`
   - If `STELLAR_FUNDER_SECRET` is set: submits **createAccount** (G) or **XLM Payment** (C) from the funder key to the user’s address.

**Proprietary middleware (implemented):** On **mainnet only**, when a **pre-invited** user (`allowed = true` before they have a wallet) registers their wallet via `POST /api/profile/wallet/register`, we **auto-fund** their account (G or C) using `STELLAR_FUNDER_SECRET`. No admin click required. See [Implemented: Auto-fund on registration (mainnet, pre-invited)](#implemented-auto-fund-on-registration-mainnet-pre-invited) below.

We do **not** use Friendbot in the backend — only as a link in the UI (e.g. set-payout-wallet, Profile) for users to fund themselves.

### USDC trustline — **manual (user-triggered)**

- **Classic (G):** After activation, user must add USDC trustline once. We provide `GET /api/profile/wallet/trustline-tx` (unsigned changeTrust XDR); user signs and submits client-side. No server-side trustline submission (we never hold the user’s secret).
- **Smart (C):** USDC is contract-dependent. Optional `SMART_ACCOUNT_USDC_SETUP_CONTRACT_ID` at activation can run a contract method; otherwise USDC setup is per contract design (e.g. pre-fund from org).

---

## Roadmap: automatic XLM funding

### Option A — Friendbot (testnet only, zero custody)

**Idea:** Right after wallet registration (or on “request activation”), fund the account by calling Stellar’s Friendbot so the user doesn’t wait for admin.

- **Mechanism:** Backend `GET https://friendbot.stellar.org/?addr=<G...>`. Friendbot creates and funds the account (testnet only).
- **Pros:** No funder key in our stack for this path; instant activation on testnet.
- **Cons:** Testnet only (no Friendbot on mainnet); only works for **classic G** (Friendbot doesn’t create C accounts); abuse risk (anyone can hit Friendbot for any G address).
- **Implementation:** After successful `POST /api/profile/wallet/register` (and only when `STELLAR_NETWORK !== 'public'`), call Friendbot for the new `stellar_public_key`. Optionally show “Account funded on testnet” in UI. No change to admin flow unless we want to skip admin for testnet.

**Steps:**

1. Add `fundViaFriendbot(accountId: string)` in `src/lib/stellar/fund.ts` (GET friendbot.stellar.org, handle errors).
2. In `POST /api/profile/wallet/register`, if network is testnet and address is G, call `fundViaFriendbot(publicKey)` after saving (non-blocking or await; document that activation can be “instant” on testnet).
3. (Optional) In Admin, for testnet, show “Funded via Friendbot” for users we didn’t fund with our funder key.

### Option B — Proprietary middleware (current funder, automated)

**Idea:** Keep using `STELLAR_FUNDER_SECRET` but trigger funding automatically on a chosen event (e.g. when user is allowed, or when they request activation), so admin doesn’t have to click “Activate” for every user.

- **Mechanism:** Same as today: `fundClassicAccount` / `fundSmartAccount` from our backend when a condition is met.
- **Pros:** Works on mainnet and testnet; supports both G and C; we control who gets funded (e.g. only if `allowed` or only if invited).
- **Cons:** Requires funder key and XLM balance; abuse/rate limits needed if trigger is “on registration.”

**Variants:**

1. **Auto-fund on activation request (recommended first step)**  
   When user calls `POST /api/profile/request-activation`, after setting `activation_requested_at`, immediately call `fundClassicAccount`/`fundSmartAccount` and set `allowed = true` (or keep admin approval but still fund so account exists).  
   Risk: every user who can request activation can drain the funder. Mitigation: only auto-fund when there is an **invite** or **allowlist pre-approval** (e.g. user already in allowed list by email/org), or rate-limit by IP/Privy.

2. **Auto-fund on registration (only for pre-invited users)** — **Implemented**  
   When `POST /api/profile/wallet/register` succeeds, if user is already `allowed` (pre-invited) and we're on **mainnet**, we call `fundAccount(toFund)` immediately (G or C). Reduces admin clicks for pre-invited users. See [Implemented: Auto-fund on registration (mainnet, pre-invited)](#implemented-auto-fund-on-registration-mainnet-pre-invited).

3. **Keep manual admin Activate, but add “Fund all pending”**  
   One button in Admin that funds all pending activation requests in one go (batch createAccount/Payment). Still manual but one click instead of N.

### Option C — Hybrid (testnet vs mainnet)

- **Testnet:** Use Friendbot for G accounts right after registration (Option A); no funder key needed for that path.
- **Mainnet (and C accounts on testnet):** Use proprietary funder (Option B) with auto-fund on activation request only when user is pre-allowed or rate-limited.

---

## Implemented: Auto-fund on registration (mainnet, pre-invited)

**Scope:** Proprietary middleware for **smart accounts and classic accounts**: auto-fund on registration, **mainnet only**, for **pre-invited** users.

### Behavior

- **When:** User successfully completes `POST /api/profile/wallet/register` (wallet saved: G and optionally C).
- **Condition:** `STELLAR_NETWORK === 'public'` (mainnet), `STELLAR_FUNDER_SECRET` is set, and `user.allowed === true` (pre-invited).
- **Action:** Backend calls `fundAccount(toFund)` where `toFund = stellar_smart_account_address ?? stellar_public_key` (prefer C if present, else G). Uses existing `fundClassicAccount` / `fundSmartAccount` via new helper `fundAccount`.
- **On success:** Response includes `funded: true` and `fund_tx_hash`. User’s wallet is live without admin having to click Activate.
- **On funding failure:** Registration still succeeds; response includes `funded: false` and `funding_error`. Client can show “Wallet registered; auto-fund failed — contact admin.”

### Code

| Piece | Location | Notes |
|-------|----------|--------|
| `fundAccount(accountId)` | `src/lib/stellar/fund.ts` | Dispatches to `fundClassicAccount` (G) or `fundSmartAccount` (C). |
| Auto-fund logic | `src/app/api/profile/wallet/register/route.ts` | After saving wallet, if mainnet + pre-invited + `toFund`, call `fundAccount(toFund)`; do not fail registration if funding fails. |
| Pre-invite | `user.allowed === true` | Admin must set `allowed = true` before the user registers a wallet (e.g. via future “Pre-invite” or by calling `POST /api/admin/activate-user` with a user who has no wallet yet — that sets `allowed = true` and skips funding). |

### Pre-inviting users

To get a user into the “pre-invited” state before they have a wallet:

- **Option A:** Super-admin calls `POST /api/admin/activate-user` with that user’s `privy_user_id` when they don’t yet have a wallet. Backend sets `allowed = true` and skips funding (no address). When the user later registers, they are auto-funded on mainnet.
- **Option B (future):** Add a dedicated “Pre-invite” action (e.g. by email or list) that sets `allowed = true` for selected users; no funding until they register.

### Env

- `STELLAR_NETWORK=public` — required for this auto-fund path (testnet does not auto-fund on registration here).
- `STELLAR_FUNDER_SECRET` — secret key of the account that funds new users (must hold XLM on mainnet).

---

## Roadmap: USDC trustline

### Classic (G) — keep user-signed flow; optional “sponsor trustline”

- **Current:** User gets unsigned changeTrust from `GET /api/profile/wallet/trustline-tx`, signs in browser, submits. Self-custodial.
- **Enhancement (optional):** If we want “one-click” without user signing, we’d need to **sponsor** the trustline (Stellar reserves) from the org/funder and optionally build a **sponsored** changeTrust so the user’s account gets the trustline with reserve paid by us. Still, the **operation** might need to be submitted by the account owner depending on Stellar’s sponsorship rules. Research: [Claimable Balances](https://developers.stellar.org/docs/learn/fundamentals/claimable-balances) or **sponsored reserves** for changeTrust.
- **Alternative:** Backend builds and **signs** the changeTrust on behalf of the user only if we temporarily have the user’s secret (e.g. via Privy embedded wallet or a one-time delegation). That would move us away from strict self-custody; not recommended unless product requires it.

### Smart (C)

- Already documented in [smart-accounts.md](../01-architecture/smart-accounts.md): contract-specific USDC setup via `SMART_ACCOUNT_USDC_SETUP_CONTRACT_ID` at activation, or pre-fund USDC from org. No classic trustline; contract holds/wraps USDC.

---

## Recommended order

| Priority | Item | Notes |
|----------|------|--------|
| — | **Auto-fund on registration for pre-invited users (Option B, variant 2)** | **Done.** Mainnet only; G and C; see [Implemented](#implemented-auto-fund-on-registration-mainnet-pre-invited) above. |
| 1 | **Auto-fund on activation request (Option B, variant 1)** with guardrails | Pre-allowlist or rate-limit; keeps one place (request-activation) to add logic. |
| 2 | **Friendbot for testnet G (Option A)** | Small change in `fund.ts` + register route; improves testnet UX. |
| 3 | **“Fund all pending” in Admin (Option B, variant 3)** | Quick win; no new triggers. |
| 4 | **USDC trustline:** document sponsored-reserve option | Research; implement only if we want zero user interaction for trustline. |

---

## Doc references

- [smart-accounts.md](../01-architecture/smart-accounts.md) — G vs C, funding, USDC for C
- [self-custodial-auth-design.md](../01-architecture/self-custodial-auth-design.md) — no custody of user keys/funds
- [phase-privy-wallet-kyc.md](../07-reference/phase-privy-wallet-kyc.md) — activation flow
- `src/lib/stellar/fund.ts` — `fundClassicAccount`, `fundSmartAccount`, `fundAccount`
- `src/app/api/profile/wallet/register/route.ts` — wallet registration + mainnet auto-fund for pre-invited
- `src/app/api/admin/activate-user/route.ts` — manual activate + fund (and pre-invite by activating user without wallet)
