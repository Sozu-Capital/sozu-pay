# Instawards Week 1 / Round 1 — Deliverable 1 Changelog

**Program:** SCF Instawards 4-week sprint — Sozu Pay  
**Deliverable:** Merchant Foundation & Onboarding  
**Product (Exponential):** SozuPay Dashboard (`sozupay-dashboard`)  
**Feature:** `cmso2a555000dkw04fqspp31a`  
**Repo:** [blessedux/sozupay_mvp](https://github.com/blessedux/sozupay_mvp)  
**Report date:** 2026-08-11 (V1.1 submission polish)

> Why this matters: establishes the operational identity of every participating merchant while hiding blockchain complexity behind a familiar Point-of-Sale experience.

---

## Joint gate (code + Figma)

V1.1 code polish and a published **3-frame Figma pack** (onboarding → store home → POS) are **both** required before all nine SOW bullets are marked checked.

| Artifact         | Status                                                                         |
| ---------------- | ------------------------------------------------------------------------------ |
| V1.1 code polish | This branch (`18-v1-1-instawards-submission-polish`)                           |
| Figma 3-pack URL | **Pending** — slot below. Do not claim “all nine checked” until a URL is here. |

**Figma 3-pack:** _pending — add the published file URL (onboarding, store home, POS) here._

---

## Nine deliverable tickets (checklist)

Exponential feature: `cmso2a555000dkw04fqspp31a` — **Instawards Week 1 — Merchant Foundation & Onboarding**

| #   | Expo # | Ticket                           | Status          | Evidence                                                     |
| --- | ------ | -------------------------------- | --------------- | ------------------------------------------------------------ |
| 1   | #9     | Merchant onboarding flow         | DONE            | `/merchants` → signup intent → create org (`type: "store"`)  |
| 2   | #10    | Merchant profile creation        | DONE            | Passkey user + org profile; `/dashboard/profile`             |
| 3   | #11    | Store creation                   | DONE            | Org-as-store; Settings `#stores` identity card               |
| 4   | #12    | Merchant Stellar wallet creation | DONE            | Smart account + Soroban treasury                             |
| 5   | #13    | Merchant authentication          | DONE            | Passkey / PIN; session + org picker                          |
| 6   | #14    | POS shell                        | DONE (V1.1)     | `/dashboard/pos` amount → local QR with amount visible       |
| 7   | #15    | Merchant dashboard foundation    | DONE (V1.1)     | Store home + nav: POS-only create-charge CTA                 |
| 8   | #16    | Design system updates            | DONE            | Shared Tailwind + EN/ES; in-app language                     |
| 9   | #17    | UX flows and prototypes          | **Not checked** | Live demo path is in code; Figma 3-pack URL is still pending |

**All-nine-checked:** no — Figma 3-pack URL is not in this file yet.

---

## V1.1 submission polish (this delivery)

- Store dashboard + nav: **POS** is the only create-charge CTA; **Get paid** is hidden for stores. QR & NFC stays on the home grid. NGO Funding link is unchanged.
- POS keeps the charged **amount** next to the QR. Distinct empty / preview / ready / new-charge states. No CLP, listener, or confirmation loop.
- POS QR is encoded **locally** (SVG). No `api.qrserver.com` on the POS path.
- Missing org settle-to address (checkout **422**) shows a **finish-setup** CTA to `/onboarding/setup-smart-wallet`. Gate is settle-to, not user `trustline-status`.
- Settings `#stores`: store name, type badge, CTAs to POS and QR & NFC. No Shopify/WooCommerce copy, no in-settings rename, no Store table.

---

## Demo script (Round 1 / V1.1)

1. Open `/merchants` → passkey signup
2. Create organization (store) → land on **Store dashboard**
3. Home and nav offer **POS** as the only create-charge entry (no Get paid)
4. Open **POS** → enter USD amount → Create charge → local QR with amount still visible
5. If the store wallet is missing, POS shows finish-setup instead of a silent 422
6. Settings → Your store: name, Store badge, links to POS and QR & NFC

---

## Historical V1 (2026-08-10)

POS shell replaced the `/dashboard/pos` redirect; Settings `#stores` reframed as org-as-store. That work lived on `feat/instawards-w1-merchant-foundation-polish` and is superseded by V1.1 on this branch (cut from `main`).

### Milestone commits (historical)

| SHA       | Date       | Message                                |
| --------- | ---------- | -------------------------------------- |
| `cc01e13` | 2026-02-19 | Dashboard foundation                   |
| `a9c6254` | 2026-03-02 | Login / org picker                     |
| `e2b4651` | 2026-03-02 | Smart account onboarding               |
| `af4f5dc` | 2026-04-30 | Release: onboarding, org wallets, tags |
| `4261250` | 2026-05-29 | Soroban org treasury                   |
| `0211052` | 2026-05-30 | Passkey auth                           |
| `a99332e` | 2026-06-13 | Merchant commerce layer                |
| `c6befbe` | 2026-06-14 | Receipts + POS session QR              |

---

## External references

- Kickoff: [Episode 1 Instawards](https://www.youtube.com/watch?v=H9N3xA8eRII) (2026-05-04)
- Wrap: [Instawards Stellar Chile: SozuPay](https://blog.telluscoop.com/p/instawards-stellar-chile-sozupay) (2026-06-04)
