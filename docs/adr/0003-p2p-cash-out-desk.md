# P2P cash-out desk: one shared order table, escrow key on the dashboard

**Status:** Proposed (Nov 6, 2026). Needs Joaquín's sign-off on the escrow account type before szp #89 deploys anything.
**Ticket:** szp #88. Unblocks szp #91–#96.

The Mujeres 2000 pilot needs a cash-out desk: she sells USDC for ARS, her USDC waits in escrow, Joaquín sends pesos from his bank, she confirms, escrow releases. It spans both apps. Sozu Wallet is where she places and confirms the order. Sozu Pay is where the desk sees the order and marks it paid. Both apps already use the same Supabase project, so they don't need to call each other.

## Decision

**Order store.** A new `desk_orders` table in the shared Supabase project, plus an append-only `desk_order_events` log. RLS on, no policies: only server routes with the service role read or write. The migration lives in sozu-pay. Neither existing table fits. `withdrawal_requests` (sozu-pay) is org-scoped and staff-initiated. `ramp_orders` (sozu-wallet) is tied to the Etherfuse provider and its statuses.

**Escrow account.** A dedicated classic `G…` account with a USDC trustline, holding nothing but open orders. Its secret (`DESK_ESCROW_SECRET`) lives only in the sozu-pay production env. The wallet never holds it. Lock is a SAC `transfer` from her `C…` to the escrow `G…`. Release goes escrow → desk receiving `G…`. Refund goes escrow → her `C…`. No new contract code.

This differs from the proposal, which says "an OpenZeppelin smart account". A classic `G` gives the same guarantees the proposal relies on: its own key, not the distribution key or the funder, empty except open orders, a hash for every movement. And it reuses a path that already works. The ramp treasury in sozu-wallet receives USDC from a `C` and pays a `C` back the same way (`lib/ramp/settlement.ts`). An OZ smart account would add a deploy and a custom Ed25519 auth-entry signer just for the escrow, two days before the deadline. The closeout should name this change, as it does for the relayer.

**Who pays fees.**
- Lock: the wallet's fee payer (szc #30), like every passkey send.
- Release and refund: the escrow `G` is its own source and pays its own fees.
- Distribution: the distribution `G` is its own source.

So the dashboard needs no shared fee payer, and fees for each role show up on that account's Horizon history for the closeout. Sharing one fee-payer key across two apps would also make them race on its sequence number.

**API surface.**

| App | Route | Who | Does |
|---|---|---|---|
| Wallet | `POST /api/desk/quote` | Beneficiary session | BCRA rate, source, time (szc #33); caps check preview |
| Wallet | `POST /api/desk/orders` | Beneficiary session | Checks caps, stores the quote and her alias/CBU, builds the unsigned C → escrow transfer, status `open` |
| Wallet | `POST /api/desk/orders/:id/lock` | Beneficiary session | Verifies the signed envelope against the order, submits it, records the lock hash, status `locked` |
| Wallet | `POST /api/desk/orders/:id/confirm` | Beneficiary session | "Recibí los pesos": sets `confirmed_at` |
| Wallet | `POST /api/desk/orders/:id/dispute` | Beneficiary session | "No me llegaron": status `disputed` |
| Wallet | `GET /api/desk/orders/:id` | Beneficiary session | Her order and receipt |
| Pay | `GET /api/desk/orders` | Desk operator | Queue with countdowns |
| Pay | `POST /api/desk/orders/:id/paid` | Desk operator | Bank transfer reference required, status `paid` |
| Pay | `POST /api/desk/orders/:id/resolve` | Desk operator | Dispute outcome: release or refund, witness name, note |
| Pay | `POST /api/desk/sweep` | Desk operator or cron secret | Releases confirmed orders, refunds timed-out ones, moves unconfirmed ones to `disputed` |

The lock check reuses `verifyOfframpEnvelope` (sozu-wallet `lib/ramp/verify-offramp-envelope.ts`) with the escrow `G` as the destination. It requires one `transfer` on the USDC SAC, `from` = her recorded `C`, `to` = escrow, `amount` = the order amount. The client signing is the same as `hooks/use-offramp.ts` `signBuild`.

**Auth between apps.** There are no cross-app calls. Each app authorizes its own side and writes to the shared table.
- Wallet routes require the signed wallet session from szc #35, and the order's `user_id` must match.
- Dashboard routes require a Pollar session, and the user's email must be in `DESK_OPERATOR_EMAILS`.
- The sweep also accepts `Authorization: Bearer $CRON_SECRET` for a Vercel cron backstop.

On event day the ops panel (szp #96) calls the sweep every few seconds, so a release follows her tap within seconds.

## Order state machine

```
open ──lock ok──▶ locked ──desk marks paid──▶ paid ──she confirms──▶ releasing ──▶ released
  │                 │                           │
  │                 └─pay deadline passes──▶ refunding ──▶ refunded
  │                                             └─"no llegó" or confirm window passes──▶ disputed
  └─never signed, 15 min──▶ expired                        disputed ──resolve──▶ releasing | refunding
```

- `open`: quote held, nothing moved. Becomes `expired` if the lock never lands. No funds involved.
- `locked`: USDC is in escrow. The pay deadline is `locked_at + order_timeout`.
- `paid`: the desk entered the bank reference. The confirm deadline is `paid_at + confirm_window`.
- `releasing` and `refunding` are claimed with a compare-and-set update (`… where id = $1 and status = $expected returning *`) before any transaction is sent. A second sweep or a double click can't pay twice. If a send fails, the order stays in `releasing`/`refunding`, the ops panel shows it, and a person checks the chain before retrying.
- Timeout only refunds orders that are `locked`. Once the desk has marked `paid`, pesos may have left Joaquín's bank. A missed confirmation goes to `disputed` and is settled in the room with a staff witness, never by a timer.
- Every transition writes a `desk_order_events` row: from, to, actor (wallet user, dashboard user, or `sweep`), hash, note. That log feeds the bug log and the closeout.

The timeout, confirm window, and caps come from env (`DESK_ORDER_TIMEOUT_SECONDS`, `DESK_CONFIRM_WINDOW_SECONDS`, `DESK_CAP_PER_ORDER_USDC`, `DESK_CAP_PER_PERSON_USDC`, `DESK_CAP_TOTAL_USDC`), so the caps sheet signed on Nov 16 can set them without a deploy. On mainnet, missing values fail closed, as in `src/lib/payouts/caps.ts`.

## Data

`desk_orders`:
- `id`, `user_id`, `smart_account` (her `C…`)
- `usdc_minor`, `ars_cents`, `rate`, `rate_source`, `rate_at`
- `bank_alias` (CBU, CVU, or alias, attested as hers)
- `status`
- `lock_hash`, `locked_at`, `pay_deadline`
- `paid_at`, `bank_ref`, `paid_by`, `confirm_deadline`, `confirmed_at`
- `release_hash`, `refund_hash`, `closed_at`
- `dispute_note`, `witness_name`
- `created_at`, `updated_at`

Caps are checked inside a Postgres function that takes an advisory lock. Per person and total desk sum every order not `refunded` or `expired`. Twenty people ordering in the same minute can't overshoot the total.

The closeout export (szp #95) redacts `bank_alias`, `bank_ref`, `user_id`, and names.

## Rejected

- **OZ smart account as escrow:** see above. Revisit only alongside a third-party-reviewed escrow contract after the pilot.
- **Escrow key in the wallet:** it would put a key that can move every open order's USDC in the app beneficiaries use, next to the highest-traffic routes.
- **Wallet calls the dashboard (HMAC) to release on confirm:** this adds cross-app auth for a few seconds of latency that the ops-panel sweep already covers.
- **Reusing `ramp_orders` or `withdrawal_requests`:** different owners, statuses, and provider coupling. Mixing the desk in would make the closeout export harder to trust.
- **Auto-release when the confirm window passes:** the proposal routes that case to a dispute in the room.

## Consequences

- szc #30 changes: the dashboard does not share the wallet's fee payer. The wallet's fee payer must re-read its sequence number at submit time. Today `submitSignedSorobanEnvelope` submits with the sequence fixed at build time, so two people sending in the same few seconds collide.
- szp #89 creates the escrow as a classic `G` with a USDC trustline (no smart-account deploy) and adds `DESK_ESCROW_SECRET` to sozu-pay prod only.
- szp #91 builds the routes above in order: `open` → `locked` → `paid` → confirm → `released`. Then #93 adds the timeout refund, #94 dispute, and #95 receipts.
