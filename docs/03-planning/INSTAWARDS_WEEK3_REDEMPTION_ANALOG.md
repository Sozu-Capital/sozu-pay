# Instawards Week 3 — Customer Redemption (honest analog)

**Program:** SCF Instawards 4-week sprint — Sozu Pay  
**Deliverable:** Customer Redemption Flow  
**Report date:** 2026-08-28

SOW expected output: a **Stellar Passport** user redeems **Coffee Tokens** via QR or NFC.

**What we submit:** the live analog on testnet — a **Sozu Wallet** (passkey) user redeems **PizzaToken (PIZZA)** at a standing QR/NFC SKU. Changelog names the mismatches; we do not claim Passport, Coffee Tokens, or Freighter/LOBSTR.

## SOW build items

| # | SOW item | Status | Evidence |
| - | -------- | ------ | -------- |
| 1 | Stellar Passport integration | **Not shipped** | Guest pays with `app.sozu.capital` passkey. No Passport SDK. |
| 2 | Universal Stellar wallet support | **Not shipped** | Checkout pay path is Sozu Wallet. |
| 3 | QR payment flow | **Analog live** | Standing SKU `https://pay.sozu.capital/pay/qr/{slug}` |
| 4 | NFC payment flow | **Analog live** | Same standing URL on store NFC |
| 5 | Coffee Token redemption | **Analog** | PizzaToken redeem to store treasury — not Coffee Token |
| 6 | Payment confirmation | **Analog live** | Guest “claimed”; cashier POS is a separate USDC loop |
| 7 | Wallet balance update | **Analog live** | Wallet shows PIZZA only when balance > 0 |
| 8 | Duplicate redemption protection | **Analog** | Standing SKU does not complete checkout; redeem decrements PIZZA |
| 9 | Live settlement detection | **Partial** | POS listener is Week 2 USDC; pizza redeem is a separate confirmation |

## Demo script (analog)

1. Guest with ≥1 PIZZA opens the standing store QR/NFC.
2. If needed, sign in on `app.sozu.capital` and return.
3. Redeem 1 PIZZA to the store org treasury.
4. Guest sees claimed; store PIZZA balance +1.

## Testnet hashes

PizzaToken **activation** (WASM upload + CreateContractV2) and **≥2 redeem** transfers are collected in the Section 6 pack:

→ [INSTAWARDS_SECTION6_EVIDENCE_PACK.md](./INSTAWARDS_SECTION6_EVIDENCE_PACK.md) (D3)

## Related

Week 2 POS USDC loop: [INSTAWARDS_WEEK2_POS_CHANGELOG.md](./INSTAWARDS_WEEK2_POS_CHANGELOG.md)  
Section 6 evidence pack: [INSTAWARDS_SECTION6_EVIDENCE_PACK.md](./INSTAWARDS_SECTION6_EVIDENCE_PACK.md)  
Auth door (2026-08-28): `/` only — see ADR `docs/adr/0002-one-pollar-door-org-type-at-create.md`.
