# Instawards November — Mainnet pilot roadmap (Mujeres 2000)

**Epic:** Mainnet-ready Sozu Pay → Sozu Wallet flow for the Mujeres 2000 pilot
**Proposal:** [Sozu_Instaward_Mainnet_Pilot_Proposal_FINAL.md](Sozu_Instaward_Mainnet_Pilot_Proposal_FINAL.md)
**Sprint:** November 1 – November 30, 2026
**Products:** SozuPay Dashboard (`pay.sozu.capital`, this repo) and Sozu Wallet (`app.sozu.capital`, `sozu-wallet` repo, Exponential product `sozucredit`)

## Fixed dates

| Date | What | Kind |
| --- | --- | --- |
| Fri Nov 6 | 20 names confirmed (aim Wed Nov 4). Cash-out desk working, mainnet relayer live, new keys created | Hard deadline |
| Thu Nov 12 | Mainnet smoke-test hashes published | Hard deadline (before the flight) |
| Fri Nov 13 | Fly to Argentina | Fixed |
| Sat Nov 14 | Workshop: what crypto is, what a blockchain is, what Sozu is | Fixed |
| Tue Nov 17 | The event: distribution, peer payments, cash-outs, interviews | Fixed |
| Thu Nov 19 | Behind-the-scenes / office documentary shoot for Mujeres 2000 | Fixed |
| Mon Nov 30 | Closeout package published | Hard deadline (end of sprint) |

The proposal says November 10. The session is now November 17, so SCF and the chapter lead need to be told (ticket 1).

## Exponential

The work is grouped under the feature **Instawards Nov — Mainnet pilot with Mujeres 2000**, created in both SozuPay Dashboard (`szp`) and SozuCredit / Sozu Wallet (`szc`). Exponential can't link dependencies across products. Those links are written in the ticket bodies and comments instead.

| Roadmap # | Ticket | Roadmap # | Ticket | Roadmap # | Ticket |
| --- | --- | --- | --- | --- | --- |
| 1 | szp #87 | 9 | szp #91 | 17 | szp #99 |
| 2 | szp #88 | 10 | szp #92 | 18 | szp #100 |
| 3 | szp #89 | 11 | szp #93 | 19 | szp #101 |
| 4 | szc #30 | 12 | szp #94 | 20 | szc #34 |
| 5 | szc #31 | 13 | szp #95 | 21 | szp #102 |
| 6 | szp #90 | 14 | szp #96 | 22 | szp #103 |
| 7 | szc #32 | 15 | szp #97 | 23 | szp #104 |
| 8 | szc #33 | 16 | szp #98 | 24 | szp #105 |

## Phases

### Phase 1 — Build (Sun Nov 1 → Fri Nov 6)

Goal: every flow works end to end on testnet, and the mainnet keys and relayer exist.

| # | Ticket | App | Due | Blocked by |
| --- | --- | --- | --- | --- |
| 1 | Lock the 20 names and tell SCF + Bastian the session moved to Nov 17 | Ops | Nov 4 (hard Nov 6) | — |
| 2 | Decide the desk architecture: where orders, the escrow key, and release/refund signing live | Both | Nov 2 | — |
| 3 | Create and fund the three mainnet keys: distribution, escrow smart account, desk receiving, plus the fee account | Ops | Nov 4 | — |
| 4 | Mainnet fee relayer for both apps, with a balance alert | Wallet + Dashboard | Nov 5 | 3 |
| 5 | Passkey smart-account onboarding on mainnet (OZ v0.7.2 pinned, WASM hash recorded) | Wallet | Nov 5 | 4 |
| 6 | Capped mainnet distribution run: one SAC transfer per person, stop on first failure, rerun a row | Dashboard | Nov 6 | 3 |
| 7 | Peer payment between smart accounts on mainnet: clear payee and amount, hash on receipt | Wallet | Nov 6 | 5 |
| 8 | Peso label from BCRA: rate, source, time. No "earnings", no APY | Wallet | Nov 6 | — |
| 9 | Desk tracer bullet: order → lock to escrow → mark paid → "I received the pesos" → release | Both | Nov 5 | 2 |
| 10 | Desk caps: per order 30, per person 30, total desk 600 USDC (lowered if 1M ARS buys less) | Both | Nov 6 | 9 |
| 11 | Desk timeout: auto-cancel and refund to her smart account, refund hash on receipt | Both | Nov 6 | 9 |
| 16 | Send the counsel questions (PSAV, custody, UIF, bank terms, data/image) | Ops | Nov 6 | — |

### Phase 2 — Harden and prove on mainnet (Sat Nov 7 → Thu Nov 12)

Goal: smoke-test hashes published before the flight.

| # | Ticket | App | Due | Blocked by |
| --- | --- | --- | --- | --- |
| 17 | Full testnet rehearsal with 3 team accounts | Both | Nov 8 | 6, 7, 10, 11 |
| 12 | Desk dispute path: resolved in the room, staff witness, logged | Both | Nov 9 | 9 |
| 13 | Desk receipts and redacted closeout export | Both | Nov 9 | 9, 11 |
| 18 | Promote both apps to prod on mainnet. Record the WASM hash and library tag | Both | Nov 9 | 5, 17 |
| 14 | Event-day ops panel: relayer balance, escrow balance, open orders with countdown | Dashboard | Nov 10 | 4, 11 |
| 15 | Spanish consent form and interview script | Ops | Nov 10 | — |
| 19 | Mainnet smoke test: receive, peer payment, cash-out, forced timeout, dispute dry run. Hashes published | Both | Nov 11 run, Nov 12 published | 12, 13, 18 |
| 20 | Workshop prep: Spanish deck, and smart-account creation at the workshop | Ops + Wallet | Nov 12 | 1, 5, 15 |
| 21 | Caps sheet and event runbook (draft) | Ops | Nov 12 | 19 |
| 23 | Documentary shoot plan and shot list for Nov 19 | Ops | Nov 12 | — |

**Freeze:** no feature merges to `prod` after the smoke test passes on Nov 11. Only fixes for smoke-test bug-log rows.

### Phase 3 — Argentina (Fri Nov 13 → Thu Nov 19)

| Date | Work |
| --- | --- |
| Nov 13 | Travel. Check relayer and escrow balances on arrival |
| Nov 14 | Workshop (ticket 20). Each beneficiary creates her mainnet smart account, checks her passkey works, and registers her alias/CBU in her own name. Any phone that fails goes in the bug log |
| Nov 15–16 | Fix workshop bug-log rows. Caps signed by Joaquín and Bastian on Nov 16 (ticket 21). Relayer check |
| Nov 17 | Event (ticket 22): distribution → peer payments → cash-outs → interviews. Every order released or refunded before anyone leaves |
| Nov 18 | Bug-log triage. Back up and redact raw footage |
| Nov 19 | Documentary shoot (ticket 23) |

### Phase 4 — Closeout (Fri Nov 20 → Mon Nov 30)

| # | Ticket | Due | Blocked by |
| --- | --- | --- | --- |
| 24 | Closeout package: edited video, every hash, redacted receipts, one-page note, bug log, filled checklist, counsel summary if allowed | Nov 30 | 22 |

Target the edited video by Nov 26 and the closeout PR by Nov 28, so there is buffer before Nov 30.

## Critical path

`2 → 9 → 11 → 17 → 18 → 19` (desk architecture → desk tracer bullet → timeout → rehearsal → prod on mainnet → smoke test). If ticket 9 is not working on testnet by Thursday Nov 5, the Nov 6 desk deadline slips. Decide that day whether dispute (12) moves to an in-room manual process recorded on paper.

## Scope of "working" on Nov 6

- **Desk:** happy path, caps, and timeout refund working on testnet. Dispute and the receipt export can land by Nov 9.
- **Relayer:** live on mainnet, paying fees for a smart-account deploy and one transfer, with a balance alert.
- **Keys:** distribution, escrow, desk receiving, and fee account created on mainnet, stored only in prod env, none of them the testnet funder.

## Open questions

- Who on the team has an Argentine bank account to receive ARS in the smoke test? The desk pays from Joaquín's personal account, so it can't be Joaquín.
- Relayer: **decided Nov 1.** The pilot uses the wallet's existing funded fee-payer pattern on mainnet. OpenZeppelin Channels, which the proposal names, moves to after the pilot. The closeout should mention this change.
- Phones: do all 20 beneficiaries have a phone that supports passkeys? The workshop on Nov 14 is the check. We need a plan for anyone without one.
