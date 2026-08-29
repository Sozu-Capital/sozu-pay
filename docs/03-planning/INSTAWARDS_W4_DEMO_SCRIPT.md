# Instawards W4 — Demo + voiceover script (≤3 min)

**Use for:** recon / till video (Exponential #84, Section 6 D4)  
**Record on:** `https://pay.sozu.capital` (prod, Store with POS)  
**Companion W3 video:** [PizzaToken redeem](https://x.com/blessed_ux/status/2093542690575077509?s=20)

Pin this in the description or title card:

> Sozu Pay Instawards — Week 4 till demo. **Sozu Wallet + PizzaToken** analog (not Passport + Coffee Tokens). Stellar **Testnet**. Partner activation path with **Tellus Coop**.

---

## Shot order (screen)

| Time | On screen |
| ---- | --------- |
| 0:00–0:15 | Title card (text above) |
| 0:15–0:45 | Signed-in store → **POS** → enter CLP → Create charge → QR visible |
| 0:45–1:20 | Pay path completes → **Paid** / receipt (CLP + payment id) |
| 1:20–1:50 | **Home / Reconciliation** — today’s CLP + charge row |
| 1:50–2:20 | **Transactions** → **Export CSV** → open CSV (id + `amount_clp`) |
| 2:20–2:55 | Optional: flash Section 6 pack / explorer for one POS hash; end card |
| ≤3:00 | Cut |

Keep talking over the demo — don’t pause the UI for long explanations.

---

## Voiceover (teleprompter)

### 1) Cold open — what we shipped (≈20s)

> This is Sozu Pay on Stellar Testnet — Instawards closeout for the Chile chapter.
>
> In four weeks we stood up a real merchant till: Google sign-in, store org, passkey wallet, CLP keypad POS, dynamic QR, Sozu-rail USDC settlement, and a reconciliation panel with CSV export.
>
> Guest redeem is a separate loop: Sozu Wallet and PizzaToken at a standing QR — same URL you can put on an NFC tag. We already posted that redeem walk; this video is the **cashier side**.

### 2) Product demo — POS to paid (≈45s)

> I’m on pay.sozu.capital as the store.
>
> Open POS. Price in **pesos** — the till never asks for USDC. Create the charge: we get a checkout URL and QR.
>
> Guest pays with Sozu Wallet on testnet. The POS listens and flips to **paid** — CLP total, payment id, ready for the next charge.
>
> That’s the Week 2 loop: merchant prices in CLP, rail settles USDC, confirmation without crypto jargon.

### 3) Product demo — recon + CSV (≈40s)

> Now the Week 4 till report.
>
> Reconciliation shows **today’s CLP** and this week’s cycle in America/Santiago — completed POS charges only. This is **owed on the till**, not a bank payout. Live peso settlement stays out of scope.
>
> Open the table, then Export CSV. The row has the payment id and `amount_clp`. That’s what a chapter reviewer needs for the settlement deliverable.

### 4) Decision change — Coffee → Pizza / Tellus Coop (≈45s)

> Quick honesty on the SOW stack.
>
> The brief named **Stellar Passport**, **Coffee Tokens**, and a WebNFC writer. We did **not** ship that literal stack.
>
> We shipped the live analog that a real partner could activate on Stellar: **Sozu Wallet** instead of Passport, **PizzaToken** instead of Coffee Tokens, and the **same standing URL** on a physical tag instead of a WebNFC commissioning tool.
>
> That choice tracks a **Tellus Coop** Stellar activation path — pizza at the counter as the redeemable credit, not a coffee-token ledger we didn’t operate. The product is the same shape: guest holds a voucher token, scans the store SKU, redeems one unit to the merchant treasury. Hashes and the redeem video are in our Section 6 evidence pack.

### 5) Close (≈15s)

> Testnet only. Mainnet deploy, KYC, and live CLP payouts are out of this sprint — we wrote that up in the mainnet readiness note.
>
> Sozu Pay: CLP till, USDC rail, PizzaToken guest loop, recon CSV. Thanks Tellus Coop — and thanks for watching.

---

## Tweet / description paste (after upload)

```text
Sozu Pay Instawards W4 — cashier till on Stellar Testnet.

CLP POS → paid → reconciliation → CSV.
Analog stack: Sozu Wallet + PizzaToken (not Passport + Coffee Tokens).
Partner path: Tellus Coop Stellar activation.

W3 redeem: https://x.com/blessed_ux/status/2093542690575077509
Evidence: docs/03-planning/INSTAWARDS_SECTION6_EVIDENCE_PACK.md
```

---

## Checklist before you hit record

- [ ] Store session logged in on prod  
- [ ] Guest / second device ready to pay the POS charge (or complete pay off-camera quickly)  
- [ ] Title card text ready  
- [ ] After upload: paste link into Section 6 D4 + Exponential #84 comment  
