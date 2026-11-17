# SozuPay Dashboard

**Canonical GitHub repo:** [Sozu-Capital/sozu-pay](https://github.com/Sozu-Capital/sozu-pay) (`origin`). Local folder may be named `SozuPay_dashboard`; see [docs/06-operations/repository-and-naming.md](docs/06-operations/repository-and-naming.md).

Dashboard for the **EMPRENDE microcredit program** with our first NGO partner **MUJERES 2000**. Used by **Equipo interno** (staff) to manage beneficiaries, disbursements, repayments, and reporting. Roadmap and feature scope are driven by [MUJERES 2000 requirements](docs/05-requirements/Requerimientos_funcionales_MUJERES_2000.pdf) and documented in [docs/03-planning/ngo-disbursement-wallet-dev-plan.md](docs/03-planning/ngo-disbursement-wallet-dev-plan.md) and [docs/03-planning/todo.md](docs/03-planning/todo.md).

**SDP integration:** This app is the **NGO operator UI** (deploy on Vercel). The **Stellar Disbursement Platform server** runs separately (containers + Postgres). Recipients use **[SozuCredit](https://github.com/blessedux/SozuCredit)**. Architecture and deploy steps: [docs/04-integrations/sdp-ngo-platform-deployment.md](docs/04-integrations/sdp-ngo-platform-deployment.md).

---

## Who uses the app

| Role | Description |
|------|-------------|
| **Equipo MUJERES 2000** | NGO staff: evaluate applications, set disbursement schedules, confirm payments, view indicators, export reports. Uses this dashboard. |
| **Emprendedora** | Recipient: apply for credit, see balance and cuotas, pay, use simulator. (Recipient-facing app and Sozu Wallet are in development.) |

---

## Architecture (simple)

```
┌─────────────────────────────────────────────────────────────┐
│  SozuPay Dashboard (this repo · Vercel)                      │
│  Next.js · Privy · NGO UI · (future) SDP API client          │
├─────────────────────────────────────────────────────────────┤
│  /login → /dashboard → disbursements, recipients, reports   │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTPS (server-side)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Stellar Disbursement Platform (hosted · NOT on Vercel)      │
│  Go API · PostgreSQL · TSS · batch payouts · invites         │
└───────────────────────────┬─────────────────────────────────┘
                            │ invite + USDC
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  SozuCredit (Vercel · credit.sozu.capital)                   │
│  Recipient wallet · /sdp/invite · SEP-10 · SEP-24            │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
              Stellar testnet / mainnet · USDC · Horizon
```

Full deployment guide: [docs/04-integrations/sdp-ngo-platform-deployment.md](docs/04-integrations/sdp-ngo-platform-deployment.md).

- **Frontend:** Next.js (React), TypeScript, Tailwind.
- **Backend:** Next.js API routes; Stellar Horizon for balance and transactions (keys and signing on server).
- **Auth:** Mock for demo (one click to dashboard); real auth and Sozu Wallet for recipients later.

---

## Quick start (developers)

```bash
npm install
cp .env.example .env.local   # optional; mock auth works without it in dev
npm run dev
```

- **App:** [http://localhost:3000](http://localhost:3000)
- **Health:** [http://localhost:3000/api/health](http://localhost:3000/api/health)

---

## How to use the app (as a user)

1. **Open the app**  
   Go to the app URL (e.g. `http://localhost:3000` or your production URL).

2. **Sign in (demo)**  
   On the login page, click **“Send magic link”**. You are taken straight to the dashboard (no email needed in demo mode).

3. **Dashboard**  
   - **Overview** — Balance, recent activity, shortcuts.
   - **Transactions** — List of USDC movements with Stellar links.
   - **Vault** — Yield and accrued balance.
   - **Payment walls** — Create shareable pay links and QR.
   - **Payouts** — Send USDC to Stellar addresses or bank (recipients).
   - **Recipients** — Manage payout recipients (name, bank).
   - **Keys & custody** — View recovery and key info.
   - **Audit log** — Sensitive actions (bank added, recovery changed, payouts).
   - **Settings** — Profile and preferences.

4. **Production**  
   Set `NEXT_PUBLIC_APP_URL` in your deployment (or the app will use the request host for redirects). For real auth later, set `AUTH_MOCK=false`.

---

## Feature scope and roadmap

- **Done:** Dashboard foundation (auth, wallet, balance, transactions, walls, payouts, recipients, audit). See [docs/03-planning/todo.md](docs/03-planning/todo.md) Phase 1–10.
- **Current focus:** NGO disbursement and MUJERES 2000: loan application, beneficiaries, disbursement schedules, credit simulator, payment management, renewal, indicators, Salesforce. See [docs/03-planning/ngo-disbursement-wallet-dev-plan.md](docs/03-planning/ngo-disbursement-wallet-dev-plan.md) and [docs/03-planning/todo.md](docs/03-planning/todo.md).

---

## Database (Supabase)

Run migrations in Supabase SQL Editor if tables don't exist: [docs/07-reference/supabase-users-table.sql](docs/07-reference/supabase-users-table.sql), [docs/07-reference/supabase-recipients-table.sql](docs/07-reference/supabase-recipients-table.sql), [docs/07-reference/supabase-organizations-table.sql](docs/07-reference/supabase-organizations-table.sql). Organizations have `type` (store | ngo) and optional `soroban_contract_id` for Phase 2 disbursement.

---

## Local tests

Automated tests do **not** need real Google. `test:e2e` starts Next on port 3010 with `POLLAR_FAKE_AUTH` so **Continue with Google** does not open an OAuth window. Org create then provisions a **real Stellar testnet G** (Friendbot + USDC trustline).

```bash
bun run test        # unit tests
bun run test:e2e    # Playwright against a local Next server with fake Pollar
bun run test:local  # both
```

Real Pollar Google login needs each origin allowlisted in [Pollar Dashboard → Build → Domains](https://dashboard.pollar.xyz) (no wildcards). Use these hosts:

| Host | What it is |
|------|------------|
| `http://localhost:3000` | Local `npm run dev` with real Pollar keys |
| `https://dev.pay.sozu.capital` | Vercel Preview for branch `dev` |
| `https://pay.sozu.capital` | Vercel Production (`prod`) |

Do not test Google on unique `*.vercel.app` SHA URLs — those are not on Pollar’s list.

---

## Docs

- **Official documentation:** [docs.sozu.capital](https://docs.sozu.capital/)
- **This repo:** [docs/README.md](docs/README.md) for the full doc index and reading order.

| Doc | Purpose |
|-----|--------|
| [docs/03-planning/todo.md](docs/03-planning/todo.md) | Task list and current focus (MUJERES 2000) |
| [docs/03-planning/ngo-disbursement-wallet-dev-plan.md](docs/03-planning/ngo-disbursement-wallet-dev-plan.md) | Full dev plan, MUJERES 2000 modules, milestones |
| [docs/00-overview/roadmap.md](docs/00-overview/roadmap.md) | Year 1 / 2 / 4 phasing |
| [docs/06-operations/runbooks.md](docs/06-operations/runbooks.md) | Local dev, env vars, plug-in points |
| [docs/00-overview/technical-spec.md](docs/00-overview/technical-spec.md) | Technical spec (foundation) |

---

## License

Private – Sozu Capital.
