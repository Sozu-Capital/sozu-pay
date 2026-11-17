# Instawards — Mainnet readiness (one-pager)

**Program:** SCF Instawards 4-week sprint — Sozu Pay  
**Deliverable:** Week 4 item 10 — Mainnet readiness assessment  
**Report date:** 2026-08-28  
**Parent feature:** July Instaward SOW — analog closeout

**Mainnet deploy is out of scope for this sprint.** This note is an assessment only — not a cutover plan, not a production launch checklist that implies we ship mainnet in Week 4.

## What is live on testnet

| Surface | URL / rail | Status |
| ------- | ---------- | ------ |
| Merchant POS (CLP keypad → USDC charge) | `https://pay.sozu.capital` | Live on Stellar **Testnet** |
| Store reconciliation (v1) | Dashboard home + `/dashboard/transactions` + CSV | Live — completed POS `amount_clp`, America/Santiago week |
| Guest redeem (PizzaToken) | Standing QR/NFC → `pay.sozu.capital/pay/qr/{slug}` | Live analog — Sozu Wallet + PIZZA |
| Guest wallet | `https://app.sozu.capital` | Live passkey wallet (Sozu Wallet) |

Production hostname is used; chain and assets remain **Testnet**.

## Analog stack (named mismatches)

The July SOW named **Stellar Passport + Coffee Tokens + NFC writer**. The shipped analog is:

- **Sozu Wallet** (passkey) instead of Stellar Passport SDK  
- **PizzaToken (PIZZA)** instead of Coffee Tokens  
- **Same standing URL on a physical tag** instead of a WebNFC commissioning tool  

Reviewers should treat evidence against this analog. Do not expect Passport, Coffee Token contracts, Freighter/LOBSTR pay paths, or WebNFC in this closeout.

## Explicitly out of this sprint

- Mainnet deploy / production Stellar network cutover  
- Production KYC / compliance program  
- Live CLP (peso) payouts or fiat ramps  
- Stellar Passport SDK  
- Coffee Token contract or coffee-token ledger  
- Freighter / LOBSTR as a merchant or guest pay path  
- WebNFC tag writer / commissioning UI  
- Multi-store, multi-cashier, refunds, catalog, inventory  
- Owed-versus-paid settlement cycles (recon is a till report only)

## Remaining before a production coffee-shop pilot

These are **post-Instawards** (or separate products), not open Week 4 tickets:

1. **Mainnet deploy** — contracts, treasury keys, fee budgets, and `pay.sozu.capital` / `app.sozu.capital` pointed at public network.  
2. **KYC / merchant onboarding** — whatever Chile pilot ops require before live pesos.  
3. **Live CLP settlement** — bank or cash-out rail; recon today only shows CLP owed from POS.  
4. **Product decision on Passport / Coffee Tokens** — keep the Sozu Wallet + PizzaToken analog, or schedule a real Passport/Coffee build.  
5. **Pilot ops** — one store, trained cashier, standing QR/NFC SKU, support path for failed redeem/POS.

## Verdict

Instawards Week 4 can close on **testnet + analog evidence**. Mainnet readiness for a live coffee shop is **not claimed** and **not delivered** by this sprint.
