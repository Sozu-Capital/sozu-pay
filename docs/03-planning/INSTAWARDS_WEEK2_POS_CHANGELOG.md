# Instawards Week 2 — Deliverable 2 Changelog

**Program:** SCF Instawards 4-week sprint — Sozu Pay  
**Deliverable:** Merchant POS & Dynamic Payments  
**Product:** SozuPay Dashboard (`sozupay-dashboard`)  
**Repo:** [blessedux/sozupay_mvp](https://github.com/blessedux/sozupay_mvp)  
**Production:** [https://pay.sozu.capital](https://pay.sozu.capital) · POS at [`/dashboard/pos`](https://pay.sozu.capital/dashboard/pos)  
**Report date:** 2026-08-15 (prod checkout unblocked after CLP schema migration)

## Stellar Testnet hashes (2026-08-15)

Live POS → QR → Sozu wallet pays on **Stellar Testnet**. Both txs succeeded.

| # | Hash | Time (UTC) | POS charge | CLP → USDC | Explorer |
| - | ---- | ---------- | ---------- | ---------- | -------- |
| 1 | `29a5140d186f896bae2be93a36260a06a5e3ded987f86ee513a2a63813081037` | 04:08 | `cs_1786766858716_avmg1hm` | 10 CLP → 0.01 USDC | [stellar.expert](https://stellar.expert/explorer/testnet/tx/29a5140d186f896bae2be93a36260a06a5e3ded987f86ee513a2a63813081037) |
| 2 | `d208cff4c2d3cfe074dcfb2f387f027e52bf78a88b4a7381d6b90a562a438411` | 04:14 | `cs_1786767239648_f3tzr2s` | 285 CLP → 0.30 USDC | [stellar.expert](https://stellar.expert/explorer/testnet/tx/d208cff4c2d3cfe074dcfb2f387f027e52bf78a88b4a7381d6b90a562a438411) |

Horizon: [tx 1](https://horizon-testnet.stellar.org/transactions/29a5140d186f896bae2be93a36260a06a5e3ded987f86ee513a2a63813081037) · [tx 2](https://horizon-testnet.stellar.org/transactions/d208cff4c2d3cfe074dcfb2f387f027e52bf78a88b4a7381d6b90a562a438411)

> Why this matters: this is the first complete cashier checkout on Stellar Testnet. The merchant prices in pesos, the rail settles USDC, and the till never asks anyone to learn a chain.

Week 1 (merchant identity, store, wallet, POS shell) is recorded in [INSTAWARDS_WEEK1_ROUND1_CHANGELOG.md](./INSTAWARDS_WEEK1_ROUND1_CHANGELOG.md). Week 2 extends that shell into a live payment loop.

---

## Expected output (SOW)

A merchant can generate a payment request and receive confirmation on Stellar Testnet.

**Evidence of completion (SOW):** working POS · dynamic QR demonstration · Testnet transaction screenshots and hashes (table above).

**Prod proof (2026-08-15):** after applying `docs/07-reference/supabase-checkout-sessions-clp-pricing.sql`, POS create persists, checkout lookup succeeds, and the Sozu rail writes the Testnet hash onto the checkout row (`completed_payment_method = sozu`).

---

## Ten SOW build items (checklist)

Exponential tickets **#19–#28**, shipped as GitHub PRs **#10–#17** on 2026-08-14.

| # | Expo | SOW item | PR | Status | Prod evidence |
| - | ---- | -------- | -- | ------ | ------------- |
| 1 | #19 | POS amount entry | [#10](https://github.com/blessedux/sozupay_mvp/pull/10) | **DONE on prod** | `/dashboard/pos` tactile keypad; amount stays visible with the QR |
| 2 | #20 | CLP pricing interface | [#11](https://github.com/blessedux/sozupay_mvp/pull/11) | **DONE on prod** | Currency label CLP; row stores `amount_clp` + USDC quote (see charge above) |
| 3 | #21 | Payment request API | [#12](https://github.com/blessedux/sozupay_mvp/pull/12) | **DONE on prod** | `POST /api/checkout/create` returns `id` + `checkoutUrl`; idempotency header |
| 4 | #22 | Dynamic QR generation | [#13](https://github.com/blessedux/sozupay_mvp/pull/13) | **DONE on prod** | Local SVG QR encodes `https://pay.sozu.capital/checkout/{id}` — scan opens that session |
| 5 | #23 | Payment expiration | [#14](https://github.com/blessedux/sozupay_mvp/pull/14) | **DONE on prod** | 15-minute `expires_at`; POS expired pane; pay path returns 410 |
| 6 | #24 | QR regeneration | [#15](https://github.com/blessedux/sozupay_mvp/pull/15) | **DONE on prod** | Regenerate keeps CLP; new id/URL; previous pending row expired |
| 7 | #25 | Transaction listener | [#16](https://github.com/blessedux/sozupay_mvp/pull/16) | **DONE on prod** | POS polls `/api/checkout/status` every 2.5s; advances to paid without refresh |
| 8 | #26 | Merchant confirmation | [#17](https://github.com/blessedux/sozupay_mvp/pull/17) | **DONE on prod** | Paid pane: CLP total + status, no crypto jargon |
| 9 | #27 | Receipt confirmation | [#17](https://github.com/blessedux/sozupay_mvp/pull/17) | **DONE on prod** | Receipt: CLP amount, time, payment id, optional reference |
| 10 | #28 | Ready-for-next-payment | [#17](https://github.com/blessedux/sozupay_mvp/pull/17) | **DONE on prod** | **New Charge** clears keypad + QR so the next amount can be entered immediately |

---

## How each item works on production

### 1. POS amount entry

Cashier opens [pay.sozu.capital/dashboard/pos](https://pay.sozu.capital/dashboard/pos). Left pane is a 3×4 keypad (1–9, decimal disabled for whole pesos, 0, backspace). The hero amount updates in place and **stays on screen** after Create charge — the QR does not replace the till amount.

- Code: `src/components/PosShell.tsx`, `src/lib/dashboard/pos-keypad.ts`
- Tests: `src/lib/dashboard/pos-keypad.test.ts`

### 2. CLP pricing interface

Merchants never type USDC. POS labels and formats **CLP** (`es-CL` thousands, whole pesos). Server derives settlement USDC:

`amountUsdc = amountClp / clpPerUsdc`

Rate order: `POS_CLP_PER_USDC` env → live Frankfurter USD→CLP → pilot fallback **950**.

Post-migration rows store `amount_clp`, `pricing_currency = CLP`, `fx_rate_clp_per_usdc`, `fx_source`. Today’s Sozu-rail charges used fallback 950 (10 CLP → 0.01 USDC; 285 CLP → 0.30 USDC).

- Code: `src/lib/pos/clp-pricing.ts`
- Tests: `src/lib/pos/clp-pricing.test.ts`
- Schema: `docs/07-reference/supabase-checkout-sessions-clp-pricing.sql` (**required on prod** — see hotfix below)

### 3. Payment request API

Authenticated `POST /api/checkout/create` with `amountClp` (and optional `Idempotency-Key`) creates one live checkout session: settle-to org treasury, CLP quote, 15-minute TTL, pay URL.

Response fields POS needs: `id`, `checkoutUrl`, `amountClp`, `amountUsd`, `expiresAt`, `idempotentReplay`. Invalid amounts → 400. Missing settle-to wallet → 422 + setup URL. Same key + same amount replays; different amount → 409.

On prod, `checkoutUrl` is `https://pay.sozu.capital/checkout/{id}` (not the wallet host).

- Code: `src/app/api/checkout/create/route.ts`, `src/lib/checkout/create-payment-request.ts`
- Tests: `src/lib/checkout/create-payment-request.test.ts`, `src/lib/checkout-url.test.ts`

### 4. Dynamic QR generation

Right pane **ready** state renders a ~256px local SVG QR (`LocalQrCode` / `qrcode.react`). Encoded value is only the live checkout URL for this charge. No `api.qrserver.com`. Scan on a phone opens `https://pay.sozu.capital/checkout/cs_…`. After the CLP migration, that page finds the session instead of “Payment link not found”.

- Code: `src/lib/dashboard/pos-qr.ts`, `src/components/PosPaymentQrCard.tsx`
- Tests: `src/lib/dashboard/pos-qr.test.ts`

### 5. Payment expiration

Default TTL **15 minutes** (`CHECKOUT_PAYMENT_TTL_MS` override). `expires_at` is written at create. Pay/public APIs treat pending-past-TTL as expired (410). POS shows a distinct expired pill and copy, not waiting/paid.

- Code: `src/lib/checkout/expiration.ts`, `src/lib/dashboard/pos-pane.ts`
- Tests: `src/lib/checkout/expiration.test.ts`, `src/lib/dashboard/pos-pane.test.ts`

### 6. QR regeneration

From expired (or explicit refresh), **Regenerate QR** re-creates a payment request with the same CLP without retyping. Server expires other pending sessions for that org (`expirePendingCheckoutSessionsForOrg`). New `id` / URL / QR replace the old one; the previous QR is unpayable.

- Code: `src/lib/dashboard/pos-regenerate.ts`
- Tests: `src/lib/dashboard/pos-regenerate.test.ts`

### 7. Transaction listener

While waiting, POS polls `GET /api/checkout/status?id=cs_…` every **2.5s**. Status `completed` → paid pane. Expired/failed never report paid. Cashier does not refresh.

- Code: `src/lib/dashboard/pos-payment-listen.ts`, `src/app/api/checkout/status/route.ts`
- Tests: `src/lib/dashboard/pos-payment-listen.test.ts`

### 8–10. Confirmation, receipt, next charge

Paid pane is visually distinct (status + CLP total). **View receipt** shows amount, local time, payment id, optional reference — no printer, no customer account. **New Charge** resets keypad, reference, QR, and paid state so the next sale starts immediately.

- Code: `src/components/PosPaidConfirmation.tsx`, `src/lib/dashboard/pos-receipt.ts`, `src/lib/dashboard/pos-ready-next.ts`
- Tests: `src/lib/dashboard/pos-receipt.test.ts`, `src/lib/dashboard/pos-ready-next.test.ts`

---

## Prod hotfix (2026-08-15) — Payment link not found

Week 2 code landed on `main` and Vercel **before** the CLP columns existed in production Postgres. `POST /api/checkout/create` inserted `amount_clp` (and related fields), Postgres rejected the row, and the route **still returned a QR URL**. Scan hit `GET /checkout/{id}` → **Payment link not found**.

**Fix applied on prod:** run [`docs/07-reference/supabase-checkout-sessions-clp-pricing.sql`](../07-reference/supabase-checkout-sessions-clp-pricing.sql) against the production Supabase project. Columns now present: `amount_clp`, `pricing_currency`, `fx_rate_clp_per_usdc`, `fx_source`, `idempotency_key`, `expires_at`.

Follow-up (code, not blocking this report): fail closed on persist — do not return `checkoutUrl` if insert throws.

---

## Demo script (Round 2 / prod)

1. Sign in on [pay.sozu.capital](https://pay.sozu.capital) as a store merchant with a settle-to treasury (`/merchants` redirects to `/`).
2. Open **POS**.
3. Key in a whole-peso amount (CLP). Amount shows with Chilean grouping.
4. **Create charge** → waiting pill + QR + same CLP total.
5. Scan the QR → `https://pay.sozu.capital/checkout/cs_…` loads that payment (not “Payment link not found”).
6. Complete payment (Sozu wallet or checkout path). POS flips to **paid** without refresh.
7. **View receipt** → CLP, time, payment id.
8. **New Charge** → empty keypad; enter the next amount.
9. Optional: wait out TTL (or shorten via `CHECKOUT_PAYMENT_TTL_MS` in a staging env) → expired pane → **Regenerate QR** keeps the amount.

---

## Milestone PRs

| PR | Merged (UTC) | SHA | Title |
| -- | ------------ | --- | ----- |
| [#10](https://github.com/blessedux/sozupay_mvp/pull/10) | 2026-08-14 05:03 | `972312b` | POS amount entry |
| [#11](https://github.com/blessedux/sozupay_mvp/pull/11) | 2026-08-14 05:08 | `a48c5d6` | CLP pricing interface |
| [#12](https://github.com/blessedux/sozupay_mvp/pull/12) | 2026-08-14 05:12 | `ca1807d` | Payment request API |
| [#13](https://github.com/blessedux/sozupay_mvp/pull/13) | 2026-08-14 05:38 | `2f84796` | Dynamic QR generation |
| [#14](https://github.com/blessedux/sozupay_mvp/pull/14) | 2026-08-14 05:58 | `27bf41d` | Payment expiration |
| [#15](https://github.com/blessedux/sozupay_mvp/pull/15) | 2026-08-14 06:02 | `1fc2d60` | QR regeneration |
| [#16](https://github.com/blessedux/sozupay_mvp/pull/16) | 2026-08-14 06:20 | `5e50486` | Transaction listener |
| [#17](https://github.com/blessedux/sozupay_mvp/pull/17) | 2026-08-14 12:16 | `cdbfdff` | Confirmation, receipt, next charge |

---

## Tests (run locally)

```bash
bun test
# Week 2 seams:
# src/lib/dashboard/pos-keypad.test.ts
# src/lib/pos/clp-pricing.test.ts
# src/lib/checkout/create-payment-request.test.ts
# src/lib/dashboard/pos-qr.test.ts
# src/lib/checkout/expiration.test.ts
# src/lib/dashboard/pos-regenerate.test.ts
# src/lib/dashboard/pos-payment-listen.test.ts
# src/lib/dashboard/pos-pane.test.ts
# src/lib/dashboard/pos-receipt.test.ts
# src/lib/dashboard/pos-ready-next.test.ts
```
