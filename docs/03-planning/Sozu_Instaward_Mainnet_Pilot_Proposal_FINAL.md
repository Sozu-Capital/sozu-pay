# Instaward request: Mujeres 2000 mainnet payout pilot

**Program:** SCF Instawards, final sprint after the July 2026 closeout
**Applicant:** Joaquín Farfán (blessedux), Stellar Chile ambassador, founder of Sozu
**Products:** Sozu Pay staff dashboard (`pay.sozu.capital`) and Sozu Wallet recipient app (`app.sozu.capital`)
**Repository:** [https://github.com/Sozu-Capital/sozu-pay](https://github.com/Sozu-Capital/sozu-pay)
**Partner:** Mujeres 2000 (Argentina), EMPRENDE program for women microentrepreneurs
**Chapter:** Chile Ambassador Chapter. The room is Mujeres 2000 in Argentina.
**Chapter lead:** Bastian Koh
**Sprint length:** 30 days from approval
**Requested amount:** $4,000 in XLM
**Funding type:** Final Funding (Mainnet Ready)
**Session date:** November 10, 2026
**Cohort:** 20 beneficiaries.

## One sentence

In 30 days, one in-person, filmed session with Mujeres 2000 receives real USDC on Stellar mainnet into passkey smart accounts, sends some of it to each other, and cashes part of it out to their own Argentine bank accounts in pesos through a capped P2P cash-out desk inside Sozu Wallet. Each person then does a short interview so we can find bugs and non-intuitive flows inside the User Interface.

## What changes from the previous draft

The previous draft kept the sprint on testnet. This one runs the session on mainnet, with real USDC, behind written gates.

Three design changes make mainnet safer than the previous plan:

1. **Smart accounts, no trustlines, no XLM for the user.** Recipients hold USDC in OpenZeppelin passkey smart accounts (contract `C...` addresses). A contract address holds a Stellar Asset Contract (SAC) balance in contract storage, not in a trustline. Network fees are paid by a relayer. The beneficiary never holds XLM.
2. **The fee-reserve bug goes away.** In the previous draft each new `G...` account was funded with 1.5 XLM. A classic account must keep 1 XLM (two base reserves) plus 0.5 XLM per trustline. With one USDC trustline, 1.5 XLM is exactly the minimum balance. Spendable XLM is zero, so the account cannot pay the fee for its first USDC payment while the dollar balance looks fine. Smart accounts plus a relayer remove that failure. There is no reserve for the beneficiary to fund.
3. **Cash-out is a capped P2P desk, not an anchor.** The beneficiary sells USDC for pesos to a desk run by Joaquín personally, in a flow that copies the Binance P2P sell side. USDC sits in escrow until the beneficiary confirms the pesos arrived in her bank. This is a pilot device. It carries regulatory questions we state plainly below, and it is replaced by a registered provider after the pilot.

## Evidence that exists today

Attached, and described as what it is:

1. **Feedback documentation.** `Requerimientos_funcionales_MUJERES_2000.pdf`. It turns the partner's current Excel credit application into a product spec, including the UX constraints for this population: simple language, large buttons, few steps, a first-run tutorial. Mujeres 2000 has approved the pilot; this PDF is the workflow spec.
2. **In-person session that already happened.** The Tellus Coop redeem, one guest at a counter, testnet, passkey wallet: [https://x.com/blessed_ux/status/2093542690575077509](https://x.com/blessed_ux/status/2093542690575077509)
3. **Product demo of the same payment.** The July till recording, builder-operated, not a customer: [https://x.com/blessed_ux/status/2093552773694370253](https://x.com/blessed_ux/status/2093552773694370253)
4. **On-chain progress.** The Section 6 evidence pack with public testnet hashes: [https://github.com/Sozu-Capital/sozu-pay/blob/dev/docs/03-planning/INSTAWARDS_SECTION6_EVIDENCE_PACK.md](https://github.com/Sozu-Capital/sozu-pay/blob/dev/docs/03-planning/INSTAWARDS_SECTION6_EVIDENCE_PACK.md)

There is no public funnel to report yet. The Mujeres2000 session, its recording, and its interviews are deliverables of this award.

## Deliverables

1. **The list.** In week 1, the chapter lead and Mujeres 2000 confirm the date (November 10, 2026) and fix the names. 20 beneficiaries. Every registered name is paid in the same run.
2. **Smart-account onboarding.** Each beneficiary creates a passkey smart account in Sozu Wallet before or at the start of the session. Fees go through the relayer.
3. **One mainnet distribution.** Real USDC from a new, dedicated distribution key to every smart account on the list. Each transfer is a SAC `transfer` to the beneficiary's `C...` address. One transaction and one hash per person. A bad batch stops: the first failed transfer halts the run until the row is fixed and rerun.
4. **Peer payments.** In the same sitting, every beneficiary sends USDC to another person in the room, smart account to smart account. Hashes recorded.
5. **P2P cash-out to her bank.** Every beneficiary sells part of her USDC for ARS through the in-wallet P2P desk. Joaquín sends ARS from his personal Argentine bank account to her CBU/CVU/alias. She confirms in the wallet that the pesos arrived. Escrow releases. Every order ends released or refunded. None is left open.
6. **Peso label.** The wallet shows the peso value of the same USDC, with the rate, the source, and the time. It never says "earnings" and never shows an APY.
7. **Interviews.** Each beneficiary does a short, filmed (with consent) interview aimed at finding bugs.
8. **Bug log.** Every stall on receive, send, or cash-out: who, step, error or hash, fix, rerun.
9. **Closeout package.** Edited video, hashes, redacted cash-out receipts, a one-page note, the bug log, and the filled checklist.

## Left out

The full Mujeres solicitud, the credit simulator, mora, rankings, Salesforce, Blend, any yield product, any screen that calls the peso change "earnings," anchor integration, and the Sozu payout contract on the payment path.

## How the session runs

### Safe launch sequence

Nothing reaches a beneficiary until steps 1 to 5 are done.

1. **Gates.** Every "Before the session" gate in the checklist is a pass, in writing.
2. **Mainnet smoke test, before the session.** Three team-owned smart accounts:
   - receive a small USDC amount from the new distribution key,
   - make one peer payment between two of them,
   - run one full P2P cash-out: a team member sells USDC to the desk, Joaquín sends ARS to that team member's own bank account, the team member confirms, escrow releases,
   - run one forced timeout (desk does not mark paid) and confirm the USDC returns to the seller,
   - run one dispute dry run with a staff witness.

   All hashes and the redacted bank references are published before the session.
3. **Caps written down the day before.** Per-person distribution amount, total distribution cap, per-order cash-out cap, per-person cash-out cap, total desk cap, order timeout, and confirmation window. Signed off by Joaquín and the chapter lead.
4. **Relayer check.** Fee account balance and alerting checked the morning of the session.
5. **Consent.** Every person who is filmed or interviewed has signed the Spanish consent form. Anyone who declines filming still takes part, off camera.
6. **Session.** Onboarding, distribution, peer payments, P2P cash-outs, interviews, in that order.
7. **Closeout.** Within the sprint.

### The P2P cash-out, step by step

This copies the Binance P2P sell side, from the beneficiary's point of view.

1. **Order.** She opens "Cash out to my bank" in Sozu Wallet. She enters a USDC amount. She sees the ARS quote: the rate, the rate source, the time, and the spread. There is no spread for the pilot; the quote is the BCRA reference rate shown on screen. She sees her own CBU/CVU/alias, which must be an account in her name.
2. **Lock.** She confirms with her passkey. Her USDC moves from her smart account into escrow. The order timer starts.
3. **Desk pays.** Joaquín sees the order in the staff dashboard. He sends the ARS amount from his personal Argentine bank account to her CBU/CVU/alias. He marks the order "paid" and enters the bank transfer reference.
4. **She confirms.** She checks her bank app and taps "I received the pesos."
5. **Release.** Escrow releases the USDC to the desk's receiving account. Both sides get a receipt.

**Timeout and auto-cancel.** If the desk does not mark the order paid within the order timeout, the order cancels and escrow returns the full USDC amount to her smart account. The refund hash goes on her receipt. The timeout and the confirmation window are fixed and written down with the caps the day before.

**Dispute path (pilot only).** If the desk marked paid and she does not see the pesos, or she does not confirm within the confirmation window, the order goes to dispute. During the pilot a dispute is resolved in person, in the room: she shows her bank app, Joaquín shows the transfer reference, and a Mujeres 2000 staff member acts as witness. The resolution (release or refund) is filmed, with consent, and logged. Neither side's bank details appear in the public video.

**Caps.** Per order: 30 USDC. Per person: 30 USDC (her full balance at most). Total desk exposure for the session: 600 USDC, covered by the 1M ARS desk liquidity at the BCRA reference rate. If the rate on the day makes 600 USDC worth more than 1M ARS, the total desk cap is lowered to match. The wallet blocks an order above the caps. The caps are written down the day before.

**Receipts.** Each receipt has the order ID, USDC amount, rate, rate source, rate time, ARS amount, lock hash, release or refund hash, bank transfer reference, and the time she confirmed. In the public closeout the bank reference, CBU/CVU/alias, and names are redacted.

**Where the ARS and USDC come from.** The ARS comes from Joaquín's personal bank account. The released USDC goes to a desk receiving account that is not the distribution key and not the escrow account.

### Escrow

**A dedicated escrow smart account controlled by Sozu.** An OpenZeppelin smart account, from the same pinned library version as the recipient wallets, used only for escrow. No new contract code. Lock is a normal SAC transfer from her smart account to the escrow account. Release and refund are SAC transfers signed by the escrow key, triggered by the dashboard. The timeout refund is run by the dashboard and checked by a person in the room. Sozu holds her USDC for the life of the order. That is custody, and we say so.

**Why this escrow.** It is simpler and safer for a capped, one-day, in-person session. It adds no new unaudited contract code to the payment path, and it uses the same audited library as the wallets. Its weakness is stated plainly: the escrow holder and the desk are the same operator, so her protection comes from process, not code. That process is the caps, the timeout refund, a staff witness in the room, filming, and a published hash for every lock, release, and refund. The escrow key is a new key. It is not the distribution key, not the desk receiving account, and not the testnet funder.

## Filming and documentation plan

**Informed consent (Spanish).** One plain-language form, read aloud. It covers what is filmed (screens, hands, voice, face only if she agrees), what it is for (SCF evidence and product bug-finding), where it is published, what is redacted (names if she asks, CBU/CVU/alias, bank references, balances in her bank app), how long the raw footage is kept, who holds it (Sozu, named contact: Joaquín Farfán), and that she can withdraw consent and ask for deletion. Separate tick boxes for: being filmed, face visible, voice used, interview quotes used, image used in public posts. Declining filming does not exclude her from the pilot or the payout.

**What is filmed.** Onboarding, receiving the distribution, a peer payment, a P2P cash-out including the moment she checks her bank app (screen angled or blurred so account data does not show), any dispute and how it is resolved, and the interviews. No filming of DNI, KYC documents, passwords, or full bank screens.

**Interview script (short, about 5 minutes, bug-finding).**

General:

- Where did you get stuck?
- What word or screen did you not understand?
- What did you expect to happen that did not happen?

Receive and peer payments:

- Did you see the USDC arrive? How did you know?
- When you sent money to another person, was it clear who you were paying and how much?

P2P cash-out:

- Was the peso amount clear before you confirmed? Did you understand the rate and where it came from?
- Did you understand that your USDC was held until you confirmed the pesos?
- Did the money arrive in your bank? How long did it take?
- Was the amount in your bank the amount the wallet showed?
- Was it clear when to tap "I received the pesos"? Did you tap it too early, or not know when?
- If the timer ran out or something went wrong, did you know what would happen to your USDC?
- Would you trust this with your own money next time? What would have to change?

**Bug log format.** One row per stall: who (anonymized ID), step (onboard, receive, peer payment, cash-out order, lock, desk paid, confirm, release, refund, dispute), error message or hash, fix, rerun result, status (open or closed).

**Closeout package.** Edited video, a list of every hash (distribution, peer payments, locks, releases, refunds), redacted cash-out receipts, a one-page note (who, the stall, the one change we made), the bug log, the filled checklist, and a summary of counsel's answers if they are in and counsel allows it to be shared.

## Success criteria

- The chapter lead and Mujeres 2000 have the date and the list in week 1.
- All 20 wallets on the registered list (100%) receive the distribution, each with a hash.
- All 20 beneficiaries complete a peer payment, with hashes.
- All 20 beneficiaries complete a P2P cash-out with the bank receipt confirmed by the beneficiary in the wallet.
- Every cash-out order ends released or refunded. No order exceeds a cap. No order stays open.
- The peso label shows rate, source, and time. A reviewer can see the rate source. No "earnings," no APY.
- Every interview is logged.
- The bug log has no open row on receive, send, or cash-out.
- The checklist is filled. The Sozu payout contract was not used.

## Budget ($4,000)

$4,000 total for the 30-day sprint, almost all of it engineering.

| Amount     | Work |
| ---------- | ---- |
| $1,200     | Smart-account onboarding on mainnet, relayer setup and monitoring, new distribution key, one SAC USDC distribution with one hash per person and stop-on-failure |
| $1,200     | P2P cash-out desk: wallet order screen, escrow account, dashboard order queue, mark paid, confirm, release, timeout refund, dispute state, receipts, and the mainnet smoke test between team members |
| $600       | Peer payments between smart accounts and the peso label (rate, source, time) |
| $1,000     | Session operations, consent forms, filming, interviews, bug fixes and reruns, closeout package and filled checklist |
| **$4,000** | **Total** |

**Not in this budget, stated separately:**

- **Distribution pool** (the USDC paid to beneficiaries): 30 USDC × 20 = 600. **Source: personal donation.** This is not taken from the award.
- **Desk ARS liquidity:** 1M ARS, from Joaquín's personal bank account (roughly 600 USD), sized to cover the 600 USDC total desk cap.
- **Network fees:** measured in the smoke test and reported in the closeout; covered by the relayer.

## Customer Development Plan

The customer is the staff member and the women in Mujeres 2000's EMPRENDE program. They run small businesses in Argentina. Staff track the credit application in Excel. The job we are validating is a payment, not the whole credit system: a list of people is paid together in USDC, each person sees that balance in pesos, can pay another person in the room, and can move part of it into her own bank account in pesos.

Progress to date is attached. It is not a moderated session with Mujeres 2000, and we are not describing it as one.

Evidence, matched to the examples in this question:

- Customer feedback documentation. Attached: the EMPRENDE requirements, `Requerimientos_funcionales_MUJERES_2000.pdf`. It transcribes the application they use today (identity, household, business, loan) and states the UX constraints for this population: simple language, large buttons, few steps per screen, a first-run tutorial. It is how we know the workflow. Mujeres 2000 has approved the pilot.
- A product session with a real counter, not with Mujeres. One guest redeeming at a Tellus Coop standing QR, on testnet, passkey wallet, in person: [https://x.com/blessed_ux/status/2093542690575077509](https://x.com/blessed_ux/status/2093542690575077509)
- Product demo of the payment, builder-operated, not a customer: [https://x.com/blessed_ux/status/2093552773694370253](https://x.com/blessed_ux/status/2093552773694370253) . Public testnet hashes: [https://github.com/Sozu-Capital/sozu-pay/blob/dev/docs/03-planning/INSTAWARDS_SECTION6_EVIDENCE_PACK.md](https://github.com/Sozu-Capital/sozu-pay/blob/dev/docs/03-planning/INSTAWARDS_SECTION6_EVIDENCE_PACK.md)
- User-testing recording with a Mujeres beneficiary: not attached. It is a deliverable of this award.
- Analytics: not attached. Both apps are behind login. There is no public funnel to report.

We already know one failure a room would hit with classic accounts: a `G...` account at 1.5 XLM with one USDC trustline has zero spendable XLM and cannot pay its fee. Hand-funded demos hide it. This pilot removes it by design with smart accounts and a relayer, and the session will show whether that holds.

What this award does with users: in week 1 the chapter lead and Mujeres 2000 confirm the November 10, 2026 date and fix the list. 20 beneficiaries. Every registered name gets paid. Before the session we run the mainnet smoke test with three team accounts and publish the hashes. In the session, staff send USDC in one batch. Every beneficiary pays another person in the room and cashes part of her USDC out to her own bank account through the P2P desk. We do not coach past the first stall; we log it. Each person does a short interview. The closeout is the video, the hashes, redacted receipts, a one-page note, the bug log, and the filled checklist.

## Mainnet Readiness Plan

**Security audits.** Sozu's disbursement-wallet contract has not had a third-party audit. Testnet WASM `8c82ffa374bfc538cd8f908dd8baa1ee0b9918262dca5a8e00aadaddb61fb0f6`. It is not on the payment path for this pilot. Distributions are direct SAC `transfer` calls from a dedicated distribution key to each smart account. Recipient wallets and the escrow account use OpenZeppelin Stellar smart accounts. OpenZeppelin published an audit of Stellar Contracts RC v0.7.0, which covers the smart accounts module. It reported a high-severity rule-selection downgrade issue in smart-account authorization, fixed before the v0.7.0 release (PR #655). We pin the latest stable release, v0.7.2. v0.7.1 and v0.7.2 are post-audit patch releases; v0.7.2 bumps `soroban_sdk` to v26.1.0 to fix an issue affecting `packages/accounts`. Those patch diffs are not covered by a separate audit report, and we say so. Before the session we record the deployed smart-account WASM hash and the library tag it was built from. PizzaToken stays on testnet. No new contract code goes on the payment path in this pilot, including the escrow.

**Regulatory compliance.** The room is in Argentina. The chapter is in Chile. The pilot moves real USDC and real pesos. The peso number in the wallet is a translation of the USDC balance at a named rate and time. It is not interest, yield, or earnings, and no APY is shown. Recipient wallets are self-custodial passkey accounts: Sozu cannot sign for, recover, or freeze them. Two parts of this pilot are not self-custodial, and we state them as risks:

- **The P2P desk.** An individual who buys virtual assets for ARS through a personal bank account, as a repeated service, may be carrying out virtual-asset exchange activity under Argentina's PSAV regime. The CNV keeps the PSAV registry under Ley 27.739 and RG 994/2024 as amended by RG 1058/2025. It also touches AML reporting to the UIF under Ley 25.246, the terms of use of a personal bank account, and tax treatment.
- **The escrow.** While an order is open, Sozu holds the beneficiary's USDC. That is custody.

These are open questions we are asking counsel in parallel, not conclusions. The answers shape the post-pilot plan; they do not block the session. The questions:

1. Does a capped, one-day, documented pilot desk run by Joaquín from his personal account fall within PSAV registration under Ley 27.739 and the CNV resolutions?
2. Does Sozu holding USDC in escrow during an order count as custody of virtual assets for a third party?
3. Does the staff dashboard, where an operator authorizes a distribution, make Sozu or Mujeres 2000 a virtual-asset transfer service?
4. What AML/UIF obligations, if any, apply to the desk, Sozu, or Mujeres 2000, and what records must be kept?
5. Do the terms of Joaquín's personal bank account allow the ARS transfers to beneficiaries in the session? What are the tax consequences for him and for the beneficiaries?
6. Under Ley 25.326 (personal data, consent) and Article 53 of the Civil and Commercial Code (image and voice), is our Spanish consent form sufficient for filming, interviews, and publishing redacted footage? Do we need to register a database?

Mitigations already in the plan: small capped amounts per order, per person, and in total; pilot only, one session; every order documented with hashes and receipts; the questions above sent to counsel in parallel; the desk is replaced after the pilot by a registered provider or anchor. We do not claim a PSAV registration, a Chile Fintec license, Persona KYC, or SOC 2.

**Technical architecture.** The balance is USDC. Mainnet uses Circle USDC (issuer `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN`) through its Stellar Asset Contract `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75`. We verified that ID three ways: Stellar's developer docs, Horizon's asset record, and local derivation from the asset and the mainnet passphrase. Testnet keeps `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`, which derives the same way. The issuer does not have `AUTH_REQUIRED` set, so a contract address can receive USDC without a trustline or a per-account authorization.

- **Recipients:** OpenZeppelin passkey smart accounts, `C...` addresses. No trustline. No XLM held by the user.
- **Distribution:** one SAC `transfer` per beneficiary from a new, dedicated mainnet distribution key. One hash per person. The run stops at the first failure.
- **Peer payments:** SAC `transfer` from one smart account to another, signed with her passkey.
- **Fees:** paid by a relayer. Primary: OpenZeppelin Relayer with the Stellar Channels service (mainnet endpoint published by OpenZeppelin), which covers fees under a fair-use policy. Fallback: a self-hosted OpenZeppelin Relayer with a dedicated, funded fee account. Launchtube is legacy and is not used. Relayer balance and failures are monitored during the session.
- **P2P cash-out:** an order record in the dashboard. Lock, release, and refund are SAC transfers between her smart account, the escrow smart account, and the desk receiving account. Each has a hash. The ARS leg is a bank transfer outside Stellar, recorded by its reference.
- **Peso price:** a named source, shown with its time. The previous draft named Frankfurter as the fallback. Frankfurter does not publish ARS, so for ARS the label uses the Banco Central de la República Argentina (BCRA) public exchange-rate API, with its date on screen. The cash-out quote is the BCRA reference rate, with no spread for the pilot, and is held for the life of the order. No oracle sits on the payment. The payment settles in USDC either way.
- **Keys:** three new, separate keys: the distribution key, the escrow key, and the desk receiving account. None of them is the testnet funder.
- **A bad batch stops.**

**Operational readiness.** A 30-day sprint, almost entirely engineering, one operator, and the desk in the room, plus Mujeres 2000 staff as witness. That is enough for one capped session and a published closeout. It is not an on-call rotation for a public network. Support during the session is a person in the room. Before the session, the smoke test runs all three flows on mainnet with team accounts. The day before, the caps are written down. During the session the relayer, the escrow balance, and the open-order queue are watched. Any order near its timeout is called out loud. After the session, every open order is closed (released or refunded) before anyone leaves, and the closeout is published within the sprint.

**Checklist.**

"Sprint" marks a gate the team can complete inside the 30 days. "External" marks a gate that depends on someone else.

| Gate                           | Now                                          | Before the session                                                                                                                                                                    | After the session                                                                                |
| ------------------------------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Partner approval (External)    | Mujeres 2000 has approved the pilot          | Date (November 10, 2026) and list of 20 confirmed with Mujeres 2000                                                                                                                   | Closeout sent to Mujeres 2000                                                                    |
| Filmed consent (Sprint)        | Not drafted                                  | Spanish form signed by every filmed or interviewed person                                                                                                                             | Footage redacted and kept per the form                                                           |
| Smart-account version (Sprint) | OpenZeppelin smart accounts on testnet       | Pinned to v0.7.2, deployed WASM hash recorded, verifier scope confirmed                                                                                                               | Same version, no change mid-pilot                                                                |
| Relayer (Sprint)               | Testnet                                      | Mainnet relayer live, fee account funded, alerting on                                                                                                                                 | Fees spent reported                                                                              |
| Distribution key (Sprint)      | Testnet funder                               | New dedicated mainnet key, not the funder                                                                                                                                             | Remaining balance reported                                                                       |
| Escrow account (Sprint)        | Not built                                    | Dedicated escrow smart account, own key, empty except open orders                                                                                                                     | Zero balance, every order closed                                                                 |
| Smoke test (Sprint)            | Not done                                     | 3 team smart accounts: receive, peer payment, P2P cash-out, forced timeout refund, dispute dry run. Hashes published                                                                  | Linked from the closeout                                                                         |
| Caps (Sprint)                  | None                                         | Per-person 30 USDC, total distribution 600 USDC, per-order 30 USDC, per-person cash-out 30 USDC, total desk 600 USDC, timeout, confirmation window. Written and signed the day before | Report shows no cap exceeded                                                                     |
| Cohort paid together           | Testnet only                                 | Same list shape, cap written down                                                                                                                                                     | All 20 registered wallets paid, one hash each                                                    |
| Peer payments                  | One builder demo on testnet                  | Tested in smoke test                                                                                                                                                                  | All 20 beneficiaries, hashes attached                                                            |
| P2P cash-out                   | Not built                                    | Tested end to end on mainnet in smoke test                                                                                                                                            | All 20 confirmed by beneficiaries in the wallet, all orders closed                               |
| Peso label                     | Fixed test rate in draft                     | BCRA source, rate, and time on screen. No "earnings"                                                                                                                                  | Same label, reviewed in interviews                                                               |
| Fee reserve                    | Bug known at 1.5 XLM on `G...` accounts      | Removed: smart accounts and relayer                                                                                                                                                   | No beneficiary held or needed XLM                                                                |
| Our payout contract            | Unaudited, testnet                           | Not on the payment path                                                                                                                                                               | Still unused                                                                                     |
| Audit                          | None on our contract; OZ v0.7.0 audit public | Pinned library tag and WASM hash recorded                                                                                                                                             | Third-party review required before our payout contract or any custom escrow contract holds funds |
| Bug log                        | Not started                                  | Smoke-test rows closed                                                                                                                                                                | No open row on receive, send, or cash-out                                                        |
| Replacement for the desk       | None                                         | Named in the plan                                                                                                                                                                     | Registered provider or anchor chosen and scoped                                                  |

## Appendix: sources

All accessed on October 19, 2026.

**Stellar network and USDC**

- Stellar Docs, minimum balance (1 XLM for two base reserves, plus 0.5 XLM per subentry, including trustlines): [https://developers.stellar.org/docs/learn/fundamentals/lumens](https://developers.stellar.org/docs/learn/fundamentals/lumens)
- Stellar Docs, Stellar Asset Contract (contract addresses hold balances in contract storage, not trustlines; `AUTH_REQUIRED` behavior; SAC `transfer` accepts a muxed address since Protocol 23): [https://developers.stellar.org/docs/tokens/stellar-asset-contract](https://developers.stellar.org/docs/tokens/stellar-asset-contract)
- Stellar Docs, sending to and receiving from contract accounts: [https://developers.stellar.org/docs/build/guides/transactions/send-and-receive-c-accounts](https://developers.stellar.org/docs/build/guides/transactions/send-and-receive-c-accounts)
- Stellar Docs, x402 page listing mainnet USDC issuer and SEP-41 contract `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75`: [https://developers.stellar.org/docs/build/agentic-payments/x402](https://developers.stellar.org/docs/build/agentic-payments/x402)
- Circle, USDC contract addresses (Stellar: `USDC-GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN`): [https://developers.circle.com/stablecoins/usdc-contract-addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses)
- Horizon asset record, which returns that `contract_id`: [https://horizon.stellar.org/assets?asset_code=USDC&asset_issuer=GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN](https://horizon.stellar.org/assets?asset_code=USDC&asset_issuer=GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN)
- Horizon issuer account flags (`auth_required: false`): [https://horizon.stellar.org/accounts/GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN](https://horizon.stellar.org/accounts/GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN)
- StellarExpert contract page: [https://stellar.expert/explorer/public/contract/CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75](https://stellar.expert/explorer/public/contract/CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75)
- Local check: `stellar-sdk` `Asset.contract_id()` with the mainnet passphrase returns `CCW67TSZ...MI75`. With the testnet passphrase and testnet issuer it returns `CBIELTK6...DAMA`.

**OpenZeppelin smart accounts and relayer**

- OpenZeppelin, Stellar Contracts RC v0.7.0 Audit: [https://www.openzeppelin.com/news/stellar-contracts-rc-v0.7.0-audit](https://www.openzeppelin.com/news/stellar-contracts-rc-v0.7.0-audit)
- Audit PDFs in the repository (`audits/Stellar Contracts Library v0.7.0 Audit.pdf`): [https://github.com/OpenZeppelin/stellar-contracts/tree/main/audits](https://github.com/OpenZeppelin/stellar-contracts/tree/main/audits)
- Fix for the rule-selection downgrade issue, PR #655 (merged March 26, 2026, label `audit-v0.7.0`): [https://github.com/OpenZeppelin/stellar-contracts/pull/655](https://github.com/OpenZeppelin/stellar-contracts/pull/655)
- OpenZeppelin, The Notorious Bug Digest #9 (describes the issue): [https://www.openzeppelin.com/news/the-notorious-bug-digest-9](https://www.openzeppelin.com/news/the-notorious-bug-digest-9)
- Release v0.7.2, latest stable (June 9, 2026): [https://github.com/OpenZeppelin/stellar-contracts/releases/tag/v0.7.2](https://github.com/OpenZeppelin/stellar-contracts/releases/tag/v0.7.2)
- Release v0.7.1: [https://github.com/OpenZeppelin/stellar-contracts/releases/tag/v0.7.1](https://github.com/OpenZeppelin/stellar-contracts/releases/tag/v0.7.1)
- OpenZeppelin Docs, smart account authorization flow: [https://docs.openzeppelin.com/stellar-contracts/accounts/authorization-flow](https://docs.openzeppelin.com/stellar-contracts/accounts/authorization-flow)
- OpenZeppelin Docs, Stellar Channels guide (mainnet and testnet endpoints, fees covered, fair use): [https://docs.openzeppelin.com/relayer/guides/stellar-channels-guide](https://docs.openzeppelin.com/relayer/guides/stellar-channels-guide)
- Stellar Docs, OpenZeppelin Relayer: [https://developers.stellar.org/docs/tools/openzeppelin-relayer](https://developers.stellar.org/docs/tools/openzeppelin-relayer)
- Launchtube README (marked legacy, superseded by OpenZeppelin Relayer and Channels): [https://github.com/stellar/launchtube](https://github.com/stellar/launchtube)

**Peso rate**

- BCRA exchange-rate API (USD quote with date): [https://api.bcra.gob.ar/estadisticascambiarias/v1.0/Cotizaciones/USD](https://api.bcra.gob.ar/estadisticascambiarias/v1.0/Cotizaciones/USD)
- Frankfurter currency list (no ARS): [https://api.frankfurter.app/currencies](https://api.frankfurter.app/currencies)

**Argentina: virtual assets, AML, data, image**

- CNV, PSAV registry page (applications via TAD since RG 1058, in force May 26, 2025): [https://www.argentina.gob.ar/cnv/registro-de-proveedores-de-servicios-de-activos-virtuales](https://www.argentina.gob.ar/cnv/registro-de-proveedores-de-servicios-de-activos-virtuales)
- CNV, creation of the PSAV registry by RG 994 (March 25, 2024), citing Ley 27.739 and Ley 25.246: [https://www.argentina.gob.ar/noticias/la-cnv-crea-el-registro-de-proveedores-de-servicios-de-activos-virtuales-psav](https://www.argentina.gob.ar/noticias/la-cnv-crea-el-registro-de-proveedores-de-servicios-de-activos-virtuales-psav)
- RG 1058/2025 text: [https://www.argentina.gob.ar/normativa/nacional/resoluci%C3%B3n-1058-2025-410635/texto](https://www.argentina.gob.ar/normativa/nacional/resoluci%C3%B3n-1058-2025-410635/texto)
- Ley 25.326, personal data protection (Art. 5 consent; Art. 6 information duties): [https://www.argentina.gob.ar/normativa/nacional/ley-25326-64790/texto](https://www.argentina.gob.ar/normativa/nacional/ley-25326-64790/texto)
- AAIP, Disposición 10/2015 (video recording and personal data): [https://www.argentina.gob.ar/normativa/nacional/disposici%C3%B3n-10-2015-243335/texto](https://www.argentina.gob.ar/normativa/nacional/disposici%C3%B3n-10-2015-243335/texto)
- Civil and Commercial Code, Art. 53 (consent to capture or reproduce image or voice): [https://leyes-ar.com/codigo_civil_y_comercial/53.htm](https://leyes-ar.com/codigo_civil_y_comercial/53.htm)

**Anchors considered as a later replacement for the desk (not part of this pilot)**

- Anclap: SEP-24 and SEP-6, ARS withdrawal to a CBU/CVU. The withdrawn asset is Anclap's ARS token, not USDC. Auth is SEP-10 only. No SEP-45 endpoint in its `stellar.toml`, so no direct contract-account support. [https://api.anclap.com/.well-known/stellar.toml](https://api.anclap.com/.well-known/stellar.toml) and [https://api.anclap.com/transfer6/info](https://api.anclap.com/transfer6/info)
- MoneyGram Ramps: SEP-24 USDC, cash pickup, not bank deposit. Its production `stellar.toml` lists a SEP-45 endpoint with a comment that the contract ID is still the testnet one, and the endpoint returned HTTP 403 when we checked. [https://mgxanchor.moneygram.com/.well-known/stellar.toml](https://mgxanchor.moneygram.com/.well-known/stellar.toml) and [https://xramps.moneygram.com/ops/developer/guides/stellar](https://xramps.moneygram.com/ops/developer/guides/stellar)
- Koywe: proprietary API (not SEP), ARS payout to named CVU accounts, lists CNV PSAV registration (Alerce Argentina SRL, Reg. No. 24). Its API supports a Stellar flow where the client sends crypto and submits the tx hash. [https://docs.koywe.com/en/core-concepts/supported-corridors](https://docs.koywe.com/en/core-concepts/supported-corridors) and [https://www.koywe.com/en/countries/AR](https://www.koywe.com/en/countries/AR)
- SEP-45 (Web Authentication for Contract Accounts, Draft): [https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0045.md](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0045.md)
