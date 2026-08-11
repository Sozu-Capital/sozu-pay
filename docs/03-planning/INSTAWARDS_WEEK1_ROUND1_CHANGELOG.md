# Instawards Week 1 / Round 1 — Deliverable 1 Changelog

**Program:** SCF Instawards (InstaWords) 4-week sprint — Sozu Pay  
**Deliverable:** Merchant Foundation & Onboarding  
**Product (Exponential):** SozuPay Dashboard (`sozupay-dashboard`)  
**Repo:** [blessedux/sozupay_mvp](https://github.com/blessedux/sozupay_mvp)  
**Report date:** 2026-08-10 (includes same-day polish push)  

> Why this matters: establishes the operational identity of every participating merchant while hiding blockchain complexity behind a familiar Point-of-Sale experience.

---

## Branches

| Branch | Tip / role |
|--------|------------|
| `main` | Production ship line |
| `feat/instawards-w1-merchant-foundation-polish` | **2026-08-10** — POS shell + store Settings polish + this changelog |
| `feat/privy-stellar-kyc` | Early auth/login (merged) |
| `feat/smart-account-onboarding` | Smart-account onboarding + planning (merged) |

---

## Nine deliverable tickets (checklist)

Exponential feature: `cmso2a555000dkw04fqspp31a` — **Instawards Week 1 — Merchant Foundation & Onboarding** (SHIPPED)

| # | Expo # | Ticket | Status | Evidence |
|---|--------|--------|--------|----------|
| 1 | #9 | Merchant onboarding flow | **DONE** | `/merchants` → signup intent → create org (`type: "store"`) |
| 2 | #10 | Merchant profile creation | **DONE** | Passkey user + org profile; `/dashboard/profile` |
| 3 | #11 | Store creation | **DONE** (2026-08-10 polish) | Org-as-store; Settings `#stores` shows current store |
| 4 | #12 | Merchant Stellar wallet creation | **DONE** | Smart account + Soroban treasury; trustline |
| 5 | #13 | Merchant authentication | **DONE** | Passkey / PIN; session + org picker |
| 6 | #14 | POS shell | **DONE** (2026-08-10 polish) | `/dashboard/pos` amount → live checkout QR |
| 7 | #15 | Merchant dashboard foundation | **DONE** | `StoreHomeDashboard` + store nav |
| 8 | #16 | Design system updates | **DONE** | Shared Tailwind + EN/ES; in-app language |
| 9 | #17 | UX flows and prototypes | **DONE** | Live demo path; Figma pack out of scope |

---

## 2026-08-10 polish (this delivery)

### Store creation (gap closed for demo)
- Settings `#stores` reframed: current org name + “this organization is your store”
- Store nav links to Settings
- Explicit Week‑1 model: one org = one store

### POS shell (gap closed for demo)
- Replaced `/dashboard/pos` redirect with `PosShell`
- Amount + optional reference → `POST /api/checkout/create` → scannable QR + copy URL
- Store home primary action points to `/dashboard/pos`
- Nav: POS + QR & NFC (permanent points remain on `/dashboard/qr-codes`)

### Files touched
- `src/components/PosShell.tsx` (new)
- `src/app/dashboard/pos/page.tsx`
- `src/components/StoreHomeDashboard.tsx`
- `src/components/DashboardNav.tsx`
- `src/app/dashboard/settings/page.tsx`
- `src/messages/en.json`, `src/messages/es.json`
- `docs/03-planning/INSTAWARDS_WEEK1_ROUND1_CHANGELOG.md`

---

## Milestone commits (historical)

| SHA | Date | Message | Diff |
|-----|------|---------|------|
| `cc01e13` | 2026-02-19 | Dashboard foundation | +10,150 |
| `a9c6254` | 2026-03-02 | Login / org picker | +536 / −88 |
| `e2b4651` | 2026-03-02 | Smart account onboarding | +848 / −45 |
| `af4f5dc` | 2026-04-30 | Release: onboarding, org wallets, tags | +18,230 / −1,202 |
| `4261250` | 2026-05-29 | Soroban org treasury | +955 / −201 |
| `0211052` | 2026-05-30 | Passkey auth | +1,899 / −320 |
| `a99332e` | 2026-06-13 | Merchant commerce layer | +4,330 / −254 |
| `c6befbe` | 2026-06-14 | Receipts + POS session QR | +693 / −194 |
| *(this branch)* | 2026-08-10 | POS shell + store Settings polish | see PR |

---

## Demo script (Round 1)

1. Open `/merchants` → passkey signup  
2. Create organization (store) → land on store dashboard  
3. Confirm Settings → Your store shows the org  
4. Open **POS** → enter amount → Create charge → show QR  
5. Optional: QR & NFC for permanent counter points  

---

## External references

- Kickoff: [Episode 1 Instawards](https://www.youtube.com/watch?v=H9N3xA8eRII) (2026-05-04)  
- Wrap: [Instawards Stellar Chile: SozuPay](https://blog.telluscoop.com/p/instawards-stellar-chile-sozupay) (2026-06-04)
