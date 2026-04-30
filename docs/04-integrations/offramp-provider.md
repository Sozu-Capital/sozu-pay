# Off-ramp / On-ramp provider plan (Conomy meeting prep)

**Context (Roadmap alignment):** Our roadmap explicitly requires **recipient off-ramp** in **Year 1 (Months 6–12)** (“MoneyGram offramp live”), because beneficiaries need a simple “cash-out” path to actually *use* the wallet day-to-day. Merchant acceptance + large-scale settlement automation comes later (Year 2), but a reliable off-ramp is a **Year 1 gate** for adoption.

This doc clarifies:
- Where on/off-ramp fits in the roadmap
- How the integration should work technically (adapter, flows, status, webhooks)
- What’s manual vs automated by phase
- The pricing/financial model to negotiate (and how to compare vendors)
- User flows for **beneficiaries** and **merchants**
- A “questions checklist” for Conomy

---

## 1) Where on/off-ramp fits in the roadmap

From `docs/roadmap.md` and `docs/ngo-disbursement-wallet-dev-plan.md`:
- **Year 1 (Foundation):** NGO distribution + recipient wallet adoption + repayment tracking + behavioral credit inputs.
- **Months 6–12:** “Onboarding (first Argentine NGO, 500–2k recipients, **offramp live**)”.
- **Offramp is P0** for recipients: “Cash out to ARS; status and receipt; limits & compliance.”

**Interpretation:** We should treat off-ramp as a *core usability layer* for beneficiaries, not a “nice-to-have” Year 2 feature. The provider choice needs to support:
- Low-friction UX (simple cash-out)
- Reliable settlement + clear statuses
- Reasonable fees at small ticket sizes (beneficiary reality)
- KYB/KYC requirements compatible with our population and NGO context

---

## 2) Target capabilities (what we need from a provider)

### 2.1 Product requirements (beneficiaries)
- **Cash-out** USDC → local fiat (ARS/CLP) to:
  - bank transfer (ideal), and/or
  - cash pickup (often necessary for the unbanked)
- **Fast and predictable**: user sees “Pending → Completed/Failed” with an ETA
- **Low minimums** and **transparent fees**
- Clear **limits** and compliance constraints (per-user/day/month)

### 2.2 Product requirements (merchants / SMBs)
- Off-ramp USDC → bank accounts (own + third-party payouts)
- Bulk payouts (later), but at minimum:
  - idempotency
  - webhooks for status
  - reconciliation exports (CSV/API)

### 2.3 Engineering requirements
- **API-first** (REST) with:
  - quote endpoint (rate + fee breakdown + TTL)
  - create payout (with idempotency key)
  - status endpoint
  - webhook events
- Sandbox + production environments
- Strong observability: provider reference IDs, failure reason codes
- Security: webhook signature verification; IP allowlists optional; key rotation

---

## 3) Recommended integration architecture (adapter-first)

We already have “adapter placeholders” in the codebase and docs (payouts mention “off-ramp via adapter”). The plan is to formalize a single interface and implement provider-specific adapters behind it.

### 3.1 Why adapter-first
- We can swap providers without reworking UI/DB models.
- We can run **manual fallback** when provider is unstable.
- We can compare vendors in parallel during pilot.

### 3.2 Proposed interface (conceptual)

**Core operations**
- `quoteOfframp({ asset, amountIn, fiatCurrency, destination }) -> { amountOut, fxRate, providerFees, networkFees, ttlMs, quoteId }`
- `createOfframp({ quoteId?, amountIn, destination, idempotencyKey, metadata }) -> { providerPayoutId, status, createdAt }`
- `getOfframpStatus({ providerPayoutId }) -> { status, failureReason?, completedAt? }`

**Optional extensions**
- `listSupportedRails()` (bank vs cash pickup; countries)
- `listLimits()` (per user; tiered)
- `validateDestination()` (IBAN/CLABE/RUT/etc.)

### 3.3 Data model we should persist (minimum)
Even before full “production” payouts, **persist**:
- payout id (internal)
- user/org id
- amount in/out
- asset + chain/network
- destination bank/cash pickup fields (tokenized where possible)
- `provider` + `providerPayoutId`
- statuses + timestamps
- raw provider response snapshot (redacted) for audit/debug
- webhook events log (signature verified)

This aligns with `docs/production-disbursements-tasks.md` (“To-Bank delegated to adapter; update pending → completed/failed”) and is required for reconciliation.

---

## 4) Phased execution: manual → automated

### Phase A — Manual ops (fastest “go-live”)
**Goal:** Beneficiaries can cash out with an ops-assisted or semi-manual flow.
- UI: user requests cash-out; we create a payout record with status `pending_ops`.
- Ops: run the provider dashboard/manual transfer if needed; mark completed/failed.

**Why:** de-risks early adoption while we learn:
- limits, KYC constraints, failure patterns
- actual SLA and refund behaviors
- fraud/chargeback surfaces (if on-ramp involved)

### Phase B — API execution, polling status
**Goal:** Backend calls provider API to create off-ramp; app polls status.
- Pros: faster, less ops work.
- Cons: still fragile without webhooks; status delays can confuse users.

### Phase C — API + webhooks (target “reliable” state)
**Goal:** Fully automated payout execution with webhook-driven status changes.
- Webhook signature verification is mandatory.
- Add reconciliation cron (compare pending payouts vs provider).

**Definition of “reliable”:** 99%+ of payouts move from `pending` to a terminal state within SLA and all failures are actionable (retryable vs permanent).

---

## 5) How Conomy likely fits (based on their public API docs)

Conomy’s public developer docs describe a **Payments** model built from:
- **origins** + **destinations** nodes (rails like `ETPAY`, `FINTOC`, `WEBPAY`, etc.)
- **currency pairs** via `product = purchaseCurrency:currency`
- lifecycle statuses: `CREATED → RECEIVED → SETTLED` (plus disputed/reversed/failed)

**What to confirm in the meeting**
- Can they support:
  - USDC on Stellar specifically (not just USDC on EVM networks)
  - CLP/ARS rails that match our users (bank transfer, open banking, cash pickup)
  - webhooks for status changes + dispute signals
- Do they expose:
  - fee breakdown per payment (fixed vs percent)
  - FX rate + spread + TTL quote
  - settlement timing per rail

**Integration mapping (conceptual)**
- On-ramp: fiat rail (origin) → internal account (destination) → then we mint/receive USDC (depending on their model).
- Off-ramp: USDC origin (our treasury/account) → fiat destination (beneficiary bank/cash).

If Conomy does not support Stellar USDC directly, we can still integrate:
- Provider handles fiat rails; **we** handle Stellar settlement separately (treasury model).

---

## 6) How Koywe fits (useful benchmark)

Koywe’s ramp docs (public) show:
- **Quote** returns explicit fee components like `koyweFee` and `networkFee`, plus a short validity window.
- ONRAMP is via “deals”; OFFRAMP can be via “orders”.
- They recommend **webhooks** for deal/order status.

Even if we don’t choose Koywe, this is a good negotiation benchmark:
- Ask Conomy for similar fee transparency and webhook event coverage.

---

## 7) Anchors (SEP-24) as another benchmark

Stellar anchors commonly expose deposit/withdraw availability and fees in SEP-24 `GET /info`, including:
- `fee_fixed`
- `fee_percent`
- min/max amounts

**Practical insight for negotiation:** even if fee schedules are opaque in sales conversations, anchor protocols are standardized enough that we should demand:
- explicit fee breakdown
- explicit FX/spread (or price endpoint)
- consistent status semantics

---

## 8) Financial model & negotiation checklist

### 8.1 Fee components to compare apples-to-apples
For each provider/route, always break total cost into:
- **Provider fee**: percent + fixed (e.g., 1% + $0.50)
- **FX spread**: difference between mid-market and executed rate
- **Network fees**: chain/network, if any (e.g., Stellar fee is tiny but custody/treasury ops can add cost)
- **Chargeback / dispute cost** (on-ramp card rails)
- **Settlement float cost**: if provider settles T+1/T+2 and we front liquidity
- **Refund cost**: payout reversal fees, failed payout handling

### 8.2 Questions for Conomy (bring to the meeting)
**Coverage & rails**
- Which corridors: **Chile (CLP)** and **Argentina (ARS)** supported today?
- Bank transfer methods: open banking (Fintoc/Etpay), ACH-equivalent, instant rails?
- Cash pickup availability (MoneyGram-like) for unbanked users?

**Stablecoin & settlement**
- Do you support **USDC on Stellar** directly? If not, which networks?
- If settlement is not on Stellar: can you settle to our bank account and we handle Stellar? What’s the operational model?
- Can we use a **prefund** model (we front USDC) vs “wait for fiat settlement” model?

**Fees & quotes**
- Exact fee schedule by rail and corridor (fixed + percent).
- How is FX quoted? TTL? Guaranteed rate vs indicative?
- Volume tiers and minimum monthly commit?

**Compliance**
- KYC requirements for end-users (beneficiaries) vs KYB for NGOs.
- Limits per user/day/month and how we can programmatically query them.
- Data requirements: what PII is mandatory at payout time?

**Automation**
- API endpoints for quote/create/status.
- Webhook events list; retry policy; signature verification method.
- Idempotency key support.
- Sandbox availability + test rails behavior.

**Ops / reliability**
- SLA (API uptime, payout completion time).
- Failure modes and error codes (insufficient funds, invalid bank, compliance hold).
- Reconciliation exports and reporting.

---

## 9) User flows (what users experience)

### 9.1 Beneficiary off-ramp (Sozu Wallet → cash-out)
1. User taps **Cash out**
2. Choose method:
   - bank transfer (preferred) OR cash pickup (if offered)
3. App shows:
   - amount in USDC
   - expected fiat out
   - fees + rate + ETA
4. User confirms (and completes any required verification)
5. Status:
   - `pending` (provider processing)
   - `completed` (receipt/reference)
   - `failed` (actionable reason + retry)

### 9.2 NGO disbursement + beneficiary offramp (end-to-end)
1. NGO disburses USDC to beneficiary wallet
2. Beneficiary either:
   - spends in USDC ecosystem (future), or
   - cashes out via offramp (this doc)
3. NGO staff can view aggregate offramp metrics (limits, failures, time-to-cash)

### 9.3 Merchant off-ramp (Dashboard → bank withdrawal)
1. Merchant selects **Withdraw**
2. Select bank account (saved)
3. See quote: fees + ETA
4. Confirm (2FA if threshold)
5. Status updates via webhook; receipt reference available in history

---

## 10) Implementation plan (what we should build next)

### 10.1 MVP scope (to be ready for a pilot)
- Define the adapter interface and one concrete adapter (Conomy if we proceed).
- Persist payout records (DB), including provider refs and status history.
- Webhook endpoint + signature verification.
- UI: beneficiary cash-out flow and status page.
- Admin/ops view: pending/failed payouts, retry, export.

### 10.2 “Nice next” (after MVP)
- Limits + compliance tiering surfaced in UI.
- Reconciliation cron job.
- Batch payouts (NGO disbursement → bank), bounded concurrency.

---

## 11) How this adjusts the roadmap (recommendation)

**Update interpretation (not necessarily dates):**
- Keep “MoneyGram offramp live (Months 6–12)” as the Year 1 target outcome.
- Make the “off-ramp provider integration” a **top-tier dependency** for beneficiary adoption (same tier as wallet onboarding).
- Use the shadow-rail POC principle: start manual if needed, but architect for automation.

**Meeting outcome target:** leave Conomy with a clear ask:
- corridor coverage (CLP/ARS),
- SDK/API + webhooks + idempotency,
- fee transparency,
- settlement model,
- and a pilot plan (sandbox → limited production allowlist).

