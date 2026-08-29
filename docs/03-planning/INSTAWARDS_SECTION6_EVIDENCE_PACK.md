# Instawards — Section 6 Evidence Pack

**Program:** SCF Instawards 4-week sprint — Sozu Pay (July 2026, Chile chapter)  
**SOW:** §6 Evidence of Completion  
**Product:** `pay.sozu.capital` (dashboard) · `app.sozu.capital` (wallet)  
**Network:** Stellar **Testnet** only  
**Feature:** `cmtdn5t3d0001l504y273eczf` — July Instaward SOW — analog closeout  
**Pack date:** 2026-08-28

## Analog disclaimer (read first)

SOW named **Stellar Passport + Coffee Tokens + WebNFC**.  
What shipped is the live analog: **Sozu Wallet (passkey) + PizzaToken (PIZZA) + the same standing URL on a physical tag**.

We do **not** claim Passport SDK, Coffee Token contracts, Freighter/LOBSTR pay paths, or a WebNFC writer. NFC evidence is the standing QR URL typed onto a tag.

---

## D1 — Merchant foundation & onboarding

| Artifact | Link / location |
| -------- | --------------- |
| GitHub (canonical) | [Sozu-Capital/sozu-pay](https://github.com/Sozu-Capital/sozu-pay) |
| Production | [https://pay.sozu.capital](https://pay.sozu.capital) |
| Figma 3-pack (onboarding → store home → POS) | [Figma](https://www.figma.com/design/GckxsHxz9LAlD8C3DNFCea/Sozu-Pay---landingpage?node-id=193-2) |
| Week 1 changelog | [INSTAWARDS_WEEK1_ROUND1_CHANGELOG.md](./INSTAWARDS_WEEK1_ROUND1_CHANGELOG.md) |
| Onboarding demo | *Attach screenshot or short clip here after recording* |

---

## D2 — Working POS + dynamic QR (USDC on testnet)

| Artifact | Link / location |
| -------- | --------------- |
| POS | [https://pay.sozu.capital/dashboard/pos](https://pay.sozu.capital/dashboard/pos) |
| Week 2 changelog | [INSTAWARDS_WEEK2_POS_CHANGELOG.md](./INSTAWARDS_WEEK2_POS_CHANGELOG.md) |

### POS USDC settlement hashes (2026-08-15)

| # | Hash | CLP → USDC | Explorer |
| - | ---- | ---------- | -------- |
| 1 | `29a5140d186f896bae2be93a36260a06a5e3ded987f86ee513a2a63813081037` | 10 CLP → 0.01 USDC | [stellar.expert](https://stellar.expert/explorer/testnet/tx/29a5140d186f896bae2be93a36260a06a5e3ded987f86ee513a2a63813081037) |
| 2 | `d208cff4c2d3cfe074dcfb2f387f027e52bf78a88b4a7381d6b90a562a438411` | 285 CLP → 0.30 USDC | [stellar.expert](https://stellar.expert/explorer/testnet/tx/d208cff4c2d3cfe074dcfb2f387f027e52bf78a88b4a7381d6b90a562a438411) |

Horizon: [tx 1](https://horizon-testnet.stellar.org/transactions/29a5140d186f896bae2be93a36260a06a5e3ded987f86ee513a2a63813081037) · [tx 2](https://horizon-testnet.stellar.org/transactions/d208cff4c2d3cfe074dcfb2f387f027e52bf78a88b4a7381d6b90a562a438411)

Automated till walk (CLP create → paid → recon → CSV): `e2e/tx.spec.ts` (PR [#27](https://github.com/Sozu-Capital/sozu-pay/pull/27)).

---

## D3 — Customer redemption (PizzaToken analog)

| Artifact | Link / location |
| -------- | --------------- |
| Week 3 analog changelog | [INSTAWARDS_WEEK3_REDEMPTION_ANALOG.md](./INSTAWARDS_WEEK3_REDEMPTION_ANALOG.md) |
| Contract registry | [testnet-contracts.md](../02-contracts/testnet-contracts.md) |
| Standing SKU pattern | `https://pay.sozu.capital/pay/qr/{slug}` (same URL for QR and NFC tag) |
| Guest wallet | [https://app.sozu.capital](https://app.sozu.capital) |
| Redeem video (≤3 min) | [X / @blessed_ux — W3 PizzaToken redeem](https://x.com/blessed_ux/status/2093542690575077509?s=20) |

### PizzaToken identity (testnet)

| Field | Value |
| ----- | ----- |
| Name / symbol / decimals | Pizza / **PIZZA** / `0` |
| Contract ID | `CDLIQJFEKJ4HGDQ7I5KOAVXOIZLCMVVICRMPK2LL3GE6PL53BQWGS4F6` |
| WASM hash | `4d80f771784327034902289ecb6209fd06330f6651f7249f5ab60b62dbab9f3b` |
| Premint | `20` to owner `GDW4KDAKWDXTTXKBJ3EPUCXQ47JOURDM3QXV623QIBNFFOO7SJT2ZQ3A` |
| Lab | [contract](https://lab.stellar.org/r/testnet/contract/CDLIQJFEKJ4HGDQ7I5KOAVXOIZLCMVVICRMPK2LL3GE6PL53BQWGS4F6) |

### PizzaToken activation hashes (deploy)

| Step | Time (UTC) | Hash | Explorer |
| ---- | ---------- | ---- | -------- |
| Upload WASM | 2026-08-19 01:48:53 | `70dd3cfbdcf8bcc725756124077c75a46608da211db71c15e5fe5769fd1923fd` | [stellar.expert](https://stellar.expert/explorer/testnet/tx/70dd3cfbdcf8bcc725756124077c75a46608da211db71c15e5fe5769fd1923fd) |
| CreateContractV2 (premint in constructor) | 2026-08-19 01:48:58 | `54ee25857cbfa942a2e826fbf2c1d7f9b18f4bf3acc4e89aacf2f695b85d3281` | [stellar.expert](https://stellar.expert/explorer/testnet/tx/54ee25857cbfa942a2e826fbf2c1d7f9b18f4bf3acc4e89aacf2f695b85d3281) |

Source account for both: `GDW4KDAKWDXTTXKBJ3EPUCXQ47JOURDM3QXV623QIBNFFOO7SJT2ZQ3A`.

### PizzaToken redeem hashes (guest → store treasury, 1 PIZZA)

Confirmed SEP-41 `transfer` invokes on `CDLIQJFE…`. Store treasury: `GD6JWCJ45EVCPZUE7HWPCJH3Q5TASBKXYCEOTCMYJ5KBD6PHHLHTF4OT` (dabrunopizza).

| # | Time (UTC) | Hash | From (guest) | Explorer |
| - | ---------- | ---- | ------------ | -------- |
| 1 | 2026-08-19 04:13 | `73d7404f74122c2ff1f455a4fc724ad9909e54d56549fe081a3851da1844e933` | `CCBXYHZQ…EVEGZ` (benfranklin) | [expert](https://stellar.expert/explorer/testnet/tx/73d7404f74122c2ff1f455a4fc724ad9909e54d56549fe081a3851da1844e933) |
| 2 | 2026-08-20 19:55 | `aeba1682dfc48d223c732c3dae629cf3409e02e826157480c8f8ede5451038e6` | `CCBXYHZQ…EVEGZ` | [expert](https://stellar.expert/explorer/testnet/tx/aeba1682dfc48d223c732c3dae629cf3409e02e826157480c8f8ede5451038e6) |
| 3 | 2026-08-20 20:45 | `2aa464deef3f91b88ff7e4b9982ccc7c5395c18aa22a4e45dc5321428b26aaac` | `CCBXYHZQ…EVEGZ` | [expert](https://stellar.expert/explorer/testnet/tx/2aa464deef3f91b88ff7e4b9982ccc7c5395c18aa22a4e45dc5321428b26aaac) |
| 4 | 2026-08-20 20:56 | `c87b77f207d291bbab95498198debe5cab9c419aa12641d256a7bf51faaabbbf` | `CCBXYHZQ…EVEGZ` | [expert](https://stellar.expert/explorer/testnet/tx/c87b77f207d291bbab95498198debe5cab9c419aa12641d256a7bf51faaabbbf) |
| 5 | 2026-08-20 21:21 | `74a7bb2f883600776b92d318379f6e90c40d77ca75f21133cb288e20dc44b469` | `CDFQUBPU…F4QLT` (other guest) | [expert](https://stellar.expert/explorer/testnet/tx/74a7bb2f883600776b92d318379f6e90c40d77ca75f21133cb288e20dc44b469) |

Source for reviewer cherry-pick (≥2 hashes): prefer **#4** `c87b77f2…` and **#5** `74a7bb2f…` (two distinct guests).

Full addresses:

- Guest smart account (benfranklin): `CCBXYHZQ6MBA5OU6BMSXMHW2MCUFXKAYOHAW2AMM4RTQC7OUUPEEVEGZ`
- Other guest: `CDFQUBPULJUCMEBY2T3EXRXIMMTXAZGPRYNU6P2VS5BOW5H4YW3F4QLT`
- Store G (dabrunopizza): `GD6JWCJ45EVCPZUE7HWPCJH3Q5TASBKXYCEOTCMYJ5KBD6PHHLHTF4OT`

Provenance: printed and Horizon-verified in chat [QR checkout styling issue](11a1b8cd-0bc9-498d-917e-015a8abbc98b); deploy pair recovered from funder history + [stellar.expert contract](https://stellar.expert/explorer/testnet/contract/CDLIQJFEKJ4HGDQ7I5KOAVXOIZLCMVVICRMPK2LL3GE6PL53BQWGS4F6).

### PizzaToken distribution evidence (video + chain)

| Layer | Evidence |
| ----- | -------- |
| Guest redeem demo | [W3 video on X](https://x.com/blessed_ux/status/2093542690575077509?s=20) — standing QR → Sozu Wallet → claimed |
| On-chain distribution | Redeem hashes above (1 PIZZA guest → store treasury); activation txs for mint/deploy |
| Partner context | Live analog with **Tellus Coop** Stellar activation path — PizzaToken at the counter instead of a Coffee Token ledger |

---

## D4 — Reconciliation & pilot readiness

| Artifact | Link / location |
| -------- | --------------- |
| Week 4 changelog | [INSTAWARDS_WEEK4_RECONCILIATION.md](./INSTAWARDS_WEEK4_RECONCILIATION.md) |
| Recon panel | Store home + `/dashboard/transactions` · CSV `GET /api/store/reconciliation?format=csv` |
| Mainnet readiness one-pager | [INSTAWARDS_MAINNET_READINESS.md](./INSTAWARDS_MAINNET_READINESS.md) (PR [#26](https://github.com/Sozu-Capital/sozu-pay/pull/26) if not yet on `dev`) |
| Pizza redeem count on recon | PR [#25](https://github.com/Sozu-Capital/sozu-pay/pull/25) |
| W4 demo / VO script | [INSTAWARDS_W4_DEMO_SCRIPT.md](./INSTAWARDS_W4_DEMO_SCRIPT.md) |
| Recon video (≤3 min) | [X / @blessed_ux — W4 till / recon](https://x.com/blessed_ux/status/2093552773694370253?s=20) |
| Dashboard screenshot + CSV sample | *Optional — attach if needed for #86* |

**Mainnet deploy is out of scope** for this sprint — see the readiness one-pager.

---

## Named-stack vs analog (honest list)

| SOW name | Status | What to show instead |
| -------- | ------ | -------------------- |
| Stellar Passport | Not shipped | Sozu Wallet passkey (`app.sozu.capital`) |
| Coffee Tokens | Not shipped | PizzaToken PIZZA (hashes above) |
| Freighter / LOBSTR | Not shipped | Pay-with-SOZU only |
| WebNFC writer | Not shipped | Same standing URL on a physical tag |
| Live CLP payout | Out of scope | Recon shows CLP owed from POS only |
| Mainnet deploy | Out of scope | Testnet + readiness note |

---

## Videos (done)

1. W3 redeem — [X](https://x.com/blessed_ux/status/2093542690575077509?s=20)  
2. W4 recon / till — [X](https://x.com/blessed_ux/status/2093552773694370253?s=20)

Optional leftover for #86: dashboard screenshot + CSV sample file. Both demo videos + hashes are linked above — tickets **#84** / **#86** can move to QA.
