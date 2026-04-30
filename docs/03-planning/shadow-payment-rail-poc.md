# Shadow payment rail — POC system design

This document captures the **MVP / POC strategy** for a “shadow payment rail”: familiar fiat UX (CLP, card-first), settlement on Stellar (USDC), with Sozu abstracting everything in between. It is a **closed-loop simulation** of the full system before wiring real partners (e.g. Conomy-style rails, webhooks, oracles).

**Related:** [technical-spec.md](../technical-spec.md), [soroban-disbursement-contract.md](../soroban-disbursement-contract.md), [org-wallet-design.md](../org-wallet-design.md).

---

## 1. MVP strategy (refined)

| Decision | Rationale |
|----------|-----------|
| **Privy** for wallet / auth infra | Email login, passkeys, programmable custody spectrum |
| **Custom ledger** (Soroban-compatible mental model) | Source of truth for balances and orders before (or alongside) on-chain |
| **Manual fiat collection first** | De-risk: you confirm CLP receipt before crediting |
| **Front liquidity (non-negotiable)** | Instant merchant UX = you prefund USDC and take short-term payment risk |
| **Card-first UX** | Merchant and payer see familiar flows |
| **API-first distribution** | `POST /create-payment`, `GET /payment-status`, `POST /withdraw` |

**Translation:** You are building an **API that converts fiat payments into instant stablecoin balances** (ledger-first, optional delayed on-chain settlement). Everything else is secondary until the POC is proven.

---

## 2. End-to-end flow (manual POC)

### 2.1 Merchant creates payment

- **Input:** e.g. `10_000` CLP (and optional memo / reference).
- **System:**
  - Inserts row in **orders** (ledger).
  - Assigns `order_id` (public reference for payer).
  - Stores **expected CLP amount**, **quoted USDC** (and/or FX snapshot at creation), **status** = `pending_payment`.

### 2.2 Customer pays (card or transfer) — MVP

- You **manually** receive CLP (bank, Stripe, payment link, etc.).
- No Conomy API / webhooks / oracle in POC — **human confirmation** replaces automation.

### 2.3 Manual confirmation → settlement trigger

- **Admin dashboard:** action **“Confirm payment”** on a matched order.
- **Effect:**
  - `ledger: order.status = confirmed` (and `confirmed_at`, `confirmed_by`).
  - Triggers **USDC credit** to merchant (see §4).

### 2.4 USDC delivery (“core magic moment”)

**Option A (simpler POC):** Credit **internal ledger** USDC balance immediately; batch or periodic **on-chain** transfer from LP wallet to merchant Stellar address later.

**Option B:** Immediately send USDC from **prefunded LP wallet** → merchant wallet (Privy-linked or org disbursement address).

POC recommendation: **ledger credit first** + optional on-chain sync job — instant UX, flexible ops.

### 2.5 Merchant sees balance

- UI: “You received 10,000 CLP (~X.XX USDC)” driven from **ledger**, not only chain.

### 2.6 Withdrawal (manual POC)

- Merchant requests withdrawal (CLP).
- Ops: send CLP manually; **deduct** USDC (or CLP-equivalent) on ledger; record **withdrawal** transaction.

---

## 3. Core components

### A. Privy (wallet layer)

- Auto-create / link wallets, email login, recovery spectrum (see hybrid MPC note in §5).
- Merchants experience **familiar login**; key material follows your custody model (MPC / user-derived org wallet, etc.).

### B. Internal ledger (most important)

**Ledger = source of truth for POC balances and order state**, not the blockchain alone.

- Enables instant “settled” UX after admin confirm.
- Soroban can mirror or settle **later** without changing the mental model.

### C. Prefunded liquidity pool (LP)

- **Sozu-controlled** wallet(s) on Stellar holding **USDC**.
- On each **confirmed** order (per policy): **debit LP** (on-chain or internal LP sub-ledger) + **credit merchant** ledger (and optionally push USDC on-chain).

### D. Admin / oracle dashboard

Replaces automation for POC:

- List orders **awaiting_confirmation**.
- Match **amount**, **reference** / memo, **payer hint** if any.
- **Confirm** → state transition + settlement job.

This **simulates** payment webhooks and an oracle.

### E. Payment API (external)

Expose minimally:

| Method | Purpose |
|--------|---------|
| `POST /create-payment` | Create order, return `order_id` + payment instructions |
| `GET /payment-status?order_id=` | `pending` / `confirmed` / `expired` / `failed` |
| `POST /withdraw` | Request CLP withdrawal (queued for manual or future automated fulfillment) |

*(Route paths are illustrative; align with your Next.js `app/api` conventions.)*

---

## 4. FX strategy

| Model | Description | POC stance |
|-------|-------------|------------|
| **Hidden spread** | Show stable CLP price; convert CLP→USDC at slightly worse internal rate (e.g. market 900, you use 920 CLP/USD) | **Recommended** — simple, disclosed in ToS |
| **Float capture** | Delay conversion and trade FX movement | Avoid — speculation, not core product |
| **Withdrawal spread** | Fair on entry; worse rate on off-ramp | Clean monetization path later |

**Recommendation for POC:** fixed **1–3%** spread (or fixed offset) on **entry** quote; no speculative FX timing.

Store on each order: `fx_rate_clp_per_usdc`, `spread_bps`, `quoted_usdc_at_creation`.

---

## 5. Why hybrid / programmable custody (not “fully self-custodial only”)

Fully self-custodial for **every** flow breaks several product needs:

- **Lost keys** → lost funds → trust loss.
- **No batching / gas abstraction** → worse UX and cost.
- **Recovery** must align with email / support policies.
- **Compliance** may require limits, freezes, monitoring — hard if you have zero policy hooks.

**Hybrid MPC / Privy-style models** sit on a spectrum: **feels** custodial to the user, **enforces** your logic, while key material can remain split or user-participatory.

**Insight:** “Non-custodial” is a spectrum; for this product you need **programmable custody** aligned with ledger + policy.

---

## 6. Instant settlement (how you “fake” it)

1. User pays (card / transfer) — **off-platform** in POC.
2. You **trust** a signal: admin clicks **Confirm**.
3. System **instantly credits** ledger (and optionally enqueues on-chain USDC).

You are **fronting liquidity** and taking **payment risk** until chargebacks / fraud controls exist.

---

## 7. Biggest risks

| Risk | Mitigation (POC → prod) |
|------|-------------------------|
| **Card chargebacks** | Delay withdrawal; limits; risk scoring; manual review |
| **LP runs out of USDC** | Dashboard LP balance alerts; reconciliation job |
| **Manual ops bottleneck** | Acceptable for POC; replace confirm with webhooks later |

---

## 8. What the POC must prove

- Merchant can **create a payment link / order**, customer pays CLP (outside flow), admin confirms, merchant **sees USDC balance immediately** on dashboard.
- Experience feels **faster and simpler** than “crypto-native” alternatives for the target user.

---

## 9. Strategic one-liner

**Build first:** an **API + ledger** that turns **fiat payment confirmation** into **instant stablecoin balances**; Stellar is the **settlement rail**, not the UX surface.

---

## 10. Design 1 — Database schema (ledger)

Below is a **POC-oriented** schema you can implement in **Supabase** (or any Postgres). Names align with a single-merchant-per-org world; adjust FKs to your existing `users` / `organizations`.

### 10.1 Entities

```sql
-- Merchant-facing balance (USDC, 7 decimals typical for display; store minor units as bigint if preferred)
CREATE TABLE IF NOT EXISTS ledger_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  stellar_address TEXT, -- optional: where on-chain USDC will be sent
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id)
);

CREATE TABLE IF NOT EXISTS ledger_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES ledger_wallets(id) ON DELETE CASCADE,
  asset_code TEXT NOT NULL DEFAULT 'USDC', -- POC: single asset
  available_minor BIGINT NOT NULL DEFAULT 0, -- smallest units (e.g. stroops or 10^7 USDC)
  pending_withdrawal_minor BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (wallet_id, asset_code)
);

CREATE TYPE payment_order_status AS ENUM (
  'pending_payment',
  'awaiting_confirmation',
  'confirmed',
  'expired',
  'cancelled',
  'failed'
);

CREATE TABLE IF NOT EXISTS payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_ref TEXT NOT NULL UNIQUE, -- short code for payers / APIs
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES ledger_wallets(id) ON DELETE CASCADE,
  amount_clp_minor BIGINT NOT NULL, -- centavos or whole CLP — pick one convention
  quoted_usdc_minor BIGINT NOT NULL,
  fx_clp_per_usdc NUMERIC(18,6) NOT NULL,
  spread_bps INT NOT NULL DEFAULT 0,
  status payment_order_status NOT NULL DEFAULT 'pending_payment',
  payer_reference TEXT, -- what customer puts in transfer memo
  expires_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  confirmed_by_user_id BIGINT REFERENCES users(id), -- matches docs/supabase-users-table.sql (BIGSERIAL)
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE ledger_tx_type AS ENUM (
  'order_credit',      -- USDC credited from confirmed fiat payment
  'withdrawal_debit',
  'lp_onchain_out',    -- USDC sent from LP wallet on-chain
  'adjustment',        -- admin correction
  'fee'
);

CREATE TABLE IF NOT EXISTS ledger_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES ledger_wallets(id) ON DELETE CASCADE,
  order_id UUID REFERENCES payment_orders(id),
  type ledger_tx_type NOT NULL,
  amount_minor BIGINT NOT NULL, -- signed: credit positive, debit negative
  balance_after_minor BIGINT,
  idempotency_key TEXT UNIQUE,
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- LP accounting (off-chain mirror of prefunded pool)
CREATE TABLE IF NOT EXISTS liquidity_pool_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL DEFAULT 'default',
  stellar_public_key TEXT NOT NULL,
  -- cached totals for dashboard; reconcile vs Horizon periodically
  cached_usdc_minor BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lp_ledger_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES liquidity_pool_accounts(id),
  order_id UUID REFERENCES payment_orders(id),
  amount_minor BIGINT NOT NULL, -- negative when USDC leaves LP on-chain or credits merchant
  tx_type TEXT NOT NULL, -- 'debit_for_merchant_credit', 'deposit', 'rebalance'
  stellar_tx_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 10.2 Invariants (application layer)

- **Confirm payment** must be **idempotent** (same order cannot double-credit).
- Use **`idempotency_key`** on `ledger_transactions` for retry-safe API.
- **Confirm** = single DB transaction: `UPDATE payment_orders SET status = confirmed`, `INSERT ledger_transactions`, `UPDATE ledger_balances`, optional `INSERT lp_ledger_transactions`.

---

## 11. Design 2 — LP smart contract logic (Soroban-ready)

POC can run **LP as a classic Stellar account** (G-address) holding USDC; this section describes how the **same rules** map to a **future Soroban pool** so you do not redesign later.

### 11.1 Roles

| Role | Responsibility |
|------|----------------|
| **Pool (contract or account)** | Holds USDC |
| **Operator** | Sozu backend / multisig — moves USDC per policy |
| **Merchant destination** | Stellar `Address` (G or funded C as per your wallet model) |

### 11.2 Soroban-ready pool (conceptual)

Align with existing [disbursement wallet pattern](../soroban-disbursement-contract.md):

- **Token:** USDC SAC (Stellar Asset Contract) address.
- **Functions (illustrative):**
  - `deposit_from_operator(amount)` — operator tops up pool; `require_auth(operator)`.
  - `payout_to_merchant(merchant: Address, amount: i128, order_ref: BytesN<32>)` — moves USDC pool → merchant; `require_auth(operator)`; emit event with `order_ref` for indexer reconciliation.
  - `balance()` — pool USDC balance query.

**Ledger remains authoritative for “instant credit”** in POC; **on-chain `payout_to_merchant`** is called when you batch settle or when policy says “immediate chain event.”

### 11.3 Mapping ledger → chain

| Ledger event | On-chain (when enabled) |
|--------------|-------------------------|
| `order_credit` | Enqueue `payout_to_merchant` with `amount = quoted_usdc` (minor units converted to i128) |
| `lp_onchain_out` | Store returned **Stellar tx hash** on `lp_ledger_transactions` / `ledger_transactions.memo` |

---

## 12. Design 3 — Admin dashboard flow (manual oracle)

### 12.1 Screens / states

1. **Inbox — “Awaiting confirmation”**  
   - Table: `public_ref`, `org`, `amount_clp`, `quoted_usdc`, `created_at`, `payer_reference`, `status`.  
   - Filter: `status IN ('pending_payment', 'awaiting_confirmation')`.

2. **Order detail**  
   - Show FX quote used, spread, expiration.  
   - Fields for ops: **internal note**, **bank reference** / screenshot link (optional).

3. **Actions**  
   - **Confirm payment** — enabled only if order not expired and status allows.  
   - **Reject / expire** — sets `failed` or `expired` with reason.

### 12.2 Confirm payment — server sequence

1. Authenticate **admin** (role `super_admin` or dedicated `ops` role).
2. `BEGIN` transaction:
   - `SELECT payment_orders ... FOR UPDATE` where `id = ?` and `status` in (…).
   - If no row → 409 / 404.
   - `UPDATE payment_orders SET status = 'confirmed', confirmed_at = now(), confirmed_by_user_id = ?`.
   - `UPDATE ledger_balances SET available_minor = available_minor + quoted_usdc_minor`.
   - `INSERT ledger_transactions (type = 'order_credit', amount_minor = +quoted_usdc_minor, order_id, idempotency_key = 'confirm:' || order_id)`.
   - `INSERT lp_ledger_transactions` (optional internal LP mirror).
3. `COMMIT`.
4. **Async job:** optional `submitStellarPayout` from LP wallet to merchant `stellar_address` (existing payout pipeline).

### 12.3 Audit

- Log **who** confirmed, **when**, and link to **ledger_transaction id** and optional **Stellar tx hash**.

---

## 13. Implementation checklist (next engineering steps)

- [ ] Add migrations for tables in §10 (or merge with existing `organizations` / `users`).
- [ ] Implement `POST /create-payment` + `GET /payment-status` (scoped by org API key or session).
- [ ] Admin page: **Payments inbox** + **Confirm** wired to the DB transaction in §12.2.
- [ ] LP balance widget + alert threshold.
- [ ] (Later) Replace manual confirm with webhook + idempotent processor.

---

*Document version: 1.0 — aligned with SozuPay dashboard and Stellar USDC settlement direction.*
