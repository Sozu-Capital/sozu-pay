# Instawards Week 4 — Merchant Reconciliation (v1)

**Program:** SCF Instawards 4-week sprint — Sozu Pay  
**Deliverable:** Merchant Reconciliation & Pilot Readiness  
**Report date:** 2026-08-28

SOW expected output: settlement dashboard with Coffee Token count, CLP owed, export, QA, demo, mainnet assessment.

**What we ship:** **Store reconciliation (v1)** on completed POS charges. Cashiers see today’s CLP, this week’s owed CLP (Monday 00:00 America/Santiago), a charge table, and CSV export. **Live CLP payouts remain out of scope.** Coffee Token count is the Week 3 PizzaToken analog in the wallet, not a merchant Coffee Token ledger.

## SOW build items

| # | SOW item | Status | Evidence |
| - | -------- | ------ | -------- |
| 1 | Transaction history | **Done (CLP for POS)** | Store home + `/dashboard/transactions` recon panel |
| 2 | Daily sales summary | **Done** | Today’s completed POS CLP |
| 3 | Current settlement cycle | **v1 week** | Monday–now in `America/Santiago`, labeled “this week” |
| 4 | Redeemed Coffee Token count | **Done (analog)** | Confirmed PizzaToken redeem count on recon panel + CSV (`pizza_redeem_count`) |
| 5 | CLP equivalent calculation | **Done** | Uses stored `amount_clp` on completed checkout rows |
| 6 | Settlement dashboard | **v1 panel** | Totals + table; not owed-vs-paid cycles |
| 7 | Exportable reconciliation report | **Done** | `GET /api/store/reconciliation?format=csv` |
| 8 | End-to-end QA | **Partial** | Unit tests on summarize/CSV; prod walk of POS → paid → panel |
| 9 | Demo preparation | **This changelog + demo script** | Below |
| 10 | Mainnet readiness assessment | **Note** | Testnet only. Mainnet deploy is SOW out of scope. Remaining: KYC, live pesos, Passport/Coffee Token. |

## Demo script

1. Sign in at `https://pay.sozu.capital` (Google). `/merchants` redirects here.
2. Create **Store with POS** if new; otherwise open the store.
3. Run a POS charge (Week 2) to completion.
4. Home: Reconciliation shows today’s CLP.
5. Transactions: full table + **Export CSV**.
6. Confirm CSV lists the payment id and `amount_clp`.

## Code

- `src/lib/store/reconciliation.ts`
- `src/app/api/store/reconciliation/route.ts`
- `src/components/StoreReconciliationPanel.tsx`
