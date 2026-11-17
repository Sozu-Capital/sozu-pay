# SozuPay Dashboard

Merchant and NGO dashboard for managing organizations, treasuries, and disbursements on Stellar. New Users sign in with **Pollar login** (Google). Passkey and backup PIN remain only for existing accounts. Organization type (**Store** vs **NGO**) is chosen at org creation, not by landing URL.

## Language

### Identity & access

**User**:
A person who can log into the dashboard and access one or more organizations.
_Avoid_: Account, member (unless referring to org membership)

**Pollar login**:
How a new User authenticates to the dashboard. V1: Google only via Pollar. Establishes the dashboard session via a **Staff Pollar identity**. Same door for **Store** and **NGO**; org type is not implied by login. The `/` landing is a **neutral door** (names both products; does not pick a type). Does not make that identity the org's spending wallet.
_Avoid_: Social login (without Pollar), OAuth (in user-facing language), sign-in with Google (as if SozuPay owned the OAuth app), two product landings (`/` vs `/merchants`) as auth options, passkey (as the new-user login), NGO-only or store-only headline on `/`

**Sozu tag**:
An optional public handle (e.g. `$maria-ngo`) on a **User**, used as a human-readable payment address — not for login. Under **Pollar login**, auth is Google; the tag may be set later via soft prompt or settings.
_Avoid_: Username (as auth identifier), tag (without "Sozu")

**Org Sozu tag**:
An optional public handle on an **Organization** used as the org's human-readable receive address.
_Avoid_: Org username

**Legacy NGO org** / **Pollar migration**:
Cancelled for this initiative — existing NGO rows are test data. Clean break to Pollar; optional one-shot DB reset script. Not a user-facing product.
_Avoid_: Migration wizard, dual-run (for NGOs in this initiative)

### Organizations & money movement

**Organization**:
A workspace a User belongs to. Type is `ngo` (**NGO** / distribution) or `store` (**Store**).
_Avoid_: Account, tenant, microcredit org (use NGO / distribution org)

**Store**:
An **Organization** with type `store` — one org is one store. Runs **POS** and standing QR/NFC. Creating a store means creating that organization as `store`. At org creation the user-facing name is **Store with POS**.
_Avoid_: Shop (as a second entity), location, venue, multi-store (Instawards out of scope)

**Merchant**:
A **User** operating a **Store**. New merchants use **Pollar login**. Existing merchants may still sign in with passkey / PIN.
_Avoid_: Seller, vendor (unless in marketing copy)

**NGO**:
An **Organization** with type `ngo` — runs distributions / disbursements to recipients. Includes microcredit partners. At org creation the user-facing name is **Distribution platform**; the persisted type remains `ngo`.
_Avoid_: Microcredit org (as a separate type), nonprofit (unless legal entity language), `distribution` as a third org type

**Disbursement**:
A batch payout from an NGO's funds to one or more recipients.
_Avoid_: Payout batch (unless referring to a specific SDP object), transfer (alone)

**Org treasury wallet**:
The Pollar-managed Stellar wallet that holds an **Organization**'s operating funds. For an **NGO**, it is the source of **Disbursements**. For a new **Store**, it is the settle-to address for **POS** / Checkout. Provisioned per org from the creator’s **Staff Pollar identity**; one G funds one org.
_Avoid_: Member wallet, personal wallet, passkey smart account (for new Pollar orgs)

**Store onboarding (Pollar path)**:
**Pollar login** → required type picker (**Store with POS**) → name the store → Pollar **Org treasury wallet** → **Store dashboard**. No passkey required to take payments. Optional device lock is Settings, not a gate.
_Avoid_: Merchant passkey onboarding (for new stores), `/merchants` as the door

**NGO onboarding (Pollar path)**:
The new-staff happy path: **Pollar login** → create **Organization** (name) → dashboard with empty **Org treasury wallet** and a fund CTA. No passkey, PIN, or smart-account linking steps. Join-by-invite is a secondary entry, not the primary CTA. Org picker only when the User already belongs to more than one org. Optional **Sozu tag** / **Org Sozu tag** are not required at create — a dismissible soft prompt on first dashboard landing nudges the User to add them.
_Avoid_: Wallet setup, smart wallet onboarding (for new NGOs)

**Disbursement confirmation**:
The in-app review step before a **Disbursement** spends from the **Org treasury wallet** — shows totals / recipients and requires an explicit Confirm. No passkey, PIN, or Pollar re-OTP in v1; authorization is session + SozuPay role, with the acting **User** recorded in the audit log.
_Avoid_: Signing ceremony, authorize with passkey

**POS** (Point of Sale):
The primary counter surface for a **Store**: enter CLP amount → create a **Checkout** → show QR. Customer pays; merchant sees confirmation. For new Pollar stores, settle-to is the **Org treasury wallet**.
_Avoid_: Get paid (as the primary store CTA), register, terminal

**Store reconciliation (v1)**:
A cashier-facing view of completed **Store** charges in CLP: transaction list, today’s total, this-cycle owed (sum of completed POS CLP in a labeled period), CSV export. Not a live peso payout. PizzaToken / wallet redemptions are the Instawards token analog, not a Coffee Token settlement engine.
_Avoid_: Settlement (as a bank payout), Coffee Token ledger (as a separate product this sprint)
A shareable payment session with an amount and URL. Merchants use it to get paid; **NGOs** use the same primitive as a **Funding link** to top up the **Org treasury wallet**.
_Avoid_: Invoice (unless a distinct billing object is introduced)

**Funding link**:
An NGO-facing name for a **Checkout** session whose settlement destination is the **Org treasury wallet**. Same create/share UX as merchant get-paid; different nav copy and settle-to address.
_Avoid_: Donation link (unless the org explicitly frames it as donations), merchant checkout (in NGO UI copy)

**NGO dashboard (v1)**:
The primary nav for distribution operators: Home (balance + fund CTA), **Funding links**, **Disbursements** (and history), **Recipients**, Transactions, Settings. Vault, credit, walls, payouts, keys, and admin are out of the primary nav for this simplification (may remain reachable later or under a deferred “More”).
_Avoid_: Full merchant nav, keys page (as a primary NGO surface)

**Staff invite**:
A one-time, expiring link that lets another person join an **Organization** after **Pollar login** (Google). The invitee’s Google account does not need to match a pre-specified email; the inviter sets the role when creating the link.
_Avoid_: Email-match invite (for NGO v1), magic link (legacy auth term)

**Staff Pollar identity**:
The Pollar login belonging to an individual **User** (Google in NGO v1). Used to authenticate to the dashboard. Distinct from the **Org treasury wallet** — staff identity does not hold the NGO's operating float.
_Avoid_: Personal wallet (when meaning spending wallet), member smart account

### Legacy (being retired for NGO staff)

**Passkey**, **Backup PIN**, **Magic link login**, **Recovery email**, **Synthetic email**, **PIN-derived signer**, **Auth method** (`passkey` / `pin_login` / `magic_link`), **Signing method** (passkey vs PIN):
Legacy SozuPay-owned identity and signing model. Superseded for new NGO staff by **Pollar login** + Pollar-managed wallet (decision: Pollar owns both identity and spending wallet).

## Relationships

- A new **User** authenticates via **Pollar login** (**Staff Pollar identity**) and may **create** at most one **Organization** (type chosen once: **Store** or **NGO**). They may still **join** other orgs via **Staff invite**.
- A new **Store** uses the Pollar **Org treasury wallet** as settle-to for **POS**; optional passkey device lock is later, not required to charge
- A **Store** takes counter payments via **POS**; **Store reconciliation (v1)** reports those charges in CLP without paying out fiat
- Existing passkey **Store** treasuries stay as they are (no migration product)
- Existing Users may still authenticate with passkey / backup PIN; that is account recovery, not a second product door
- A **User** may have zero or one **Sozu tag** (optional; for payments / display — never for auth under the NGO Pollar path)
- An **Organization** may have zero or one **Org Sozu tag**
- An **NGO** has exactly one **Org treasury wallet** (server-provisioned against the org, not against a staff login)
- An **NGO** runs **Disbursements** that spend from its **Org treasury wallet**
- An **NGO** tops up its **Org treasury wallet** via a **Funding link** (Checkout primitive, NGO-skinned; settlement destination = org treasury)
- An authorized **User** triggers a spend after **Disbursement confirmation**; SozuPay checks roles, then the backend asks Pollar to execute from the **Org treasury wallet** (target). Actor attribution lives in SozuPay audit logs.
- **Fallback if Pollar cannot server-spend**: **Org treasury wallet** remains bound to the creator’s **Staff Pollar identity**; other staff queue disbursements and the wallet owner approves (approval-request UX)
- NGO passkey dual-run / migration UI is out of scope — clean break + optional test-data reset; existing merchant passkey accounts remain sign-inable, not migrated
- **NGO dashboard (v1)** is the default surface for distribution operators; advanced modules are not primary nav
- Additional staff join via **Staff invite** (expiring link → Google **Pollar login** → membership + role)

## Example dialogue

> **Dev:** "Maria signs in with Google via Pollar. Does she still get a passkey prompt to start a disbursement?"
> **Domain expert:** "No. Her **Staff Pollar identity** opens the dashboard; the **Org treasury wallet** moves the money after SozuPay role checks."

> **Dev:** "Must she pick a Sozu tag before she can create her NGO?"
> **Domain expert:** "No. Tag is optional — she can add `$maria` later so people can pay her by handle. Login is still Google."

> **Dev:** "Carlos needs to run payroll while Maria is on vacation. Can he?"
> **Domain expert:** "Yes under the target model — if he has treasury permission, the backend spends from the shared **Org treasury wallet**. If we had to take the fallback, he'd queue it for Maria to approve."

> **Dev:** "How does María fund the org without pasting a Stellar address on WhatsApp?"
> **Domain expert:** "She creates a **Funding link** — same **Checkout** under the hood as merchants — shares the URL, payers use whatever methods Checkout already supports; USDC lands in the **Org treasury wallet**. Fancy card rails are a later Checkout upgrade."

> **Dev:** "Who can start a disbursement — and do they Face ID?"
> **Domain expert:** "Anyone with treasury permission. They get **Disbursement confirmation** (review + Confirm), not a passkey. We log who confirmed."

> **Dev:** "What about the old passkey test NGOs?"
> **Domain expert:** "Throw them away — reset test data if needed. No migration product."

> **Dev:** "Maria WhatsApps Carlos an invite. His Google is personal Gmail, not ngo.org. Can he join?"
> **Domain expert:** "Yes — **Staff invite** is a link, not an email match. He Google-signs in and lands in the org with the role she picked."

> **Dev:** "When do they set $fundacion?"
> **Domain expert:** "After first landing — a dismissible soft prompt. Create-org is just the org name."

> **Dev:** "What does María see in the sidebar on day one?"
> **Domain expert:** "Home, Funding links, Disbursements, Recipients, Transactions, Settings — the **NGO dashboard (v1)**. Not vault, credit, or keys."

> **Dev:** "Is a 'microcredit org' a different product type from NGO?"
> **Domain expert:** "No — it's an **NGO** (`type: ngo`) running distributions. We don't have a separate microcredit org type."

> **Dev:** "Do we need Stellar Passport and Coffee Tokens to close Instawards?"
> **Domain expert:** "No for this close-out. Submit the live analog: Sozu Wallet redeems PizzaToken via QR/NFC. Name the SOW mismatch in the changelog."

> **Dev:** "A merchant doesn't want Gmail. Can they create a store with a passkey?"
> **Domain expert:** "Not as a new account. **Pollar login** is the new-user door. Passkey is only if they already have an account."

> **Dev:** "Should café owners go to /merchants and NGOs to /?"
> **Domain expert:** "No. One door: `/`. `/merchants` redirects there. They choose **Store** or **NGO** when they create the organization."

> **Dev:** "Is a distribution platform a new org type?"
> **Domain expert:** "No. That's the create-org label for an **NGO**. Cards: Store with POS → `store`; Distribution platform → `ngo`."

> **Dev:** "María created a store, then wants an NGO on the same Google."
> **Domain expert:** "She cannot create a second org. One **Staff Pollar identity** wallet funds one treasury. Join an NGO with a **Staff invite**, or use a different Google account."

> **Dev:** "Does the store need a passkey before POS works?"
> **Domain expert:** "Not for new merchants. Google creates the store wallet. Face ID is optional later in Settings."

> **Dev:** "Does W4 mean we pay the café in pesos?"
> **Domain expert:** "No. **Store reconciliation (v1)** shows CLP owed and a CSV. Live CLP payout is out of Instawards scope."

> **Dev:** "Should the home page sell POS or disbursements?"
> **Domain expert:** "Neither. `/` is a neutral door. They pick **Store with POS** or **Distribution platform** at create."

## Flagged ambiguities

- **Pollar server-spend capability**: spike required — confirm funds can move from a server-provisioned org wallet under SozuPay's secret key (or equivalent). Fallback is creator-bound wallet + approval queue.
- Email OTP / passkey login for NGOs: explicitly deferred past Google-only v1. Passkey remains existing-account recovery on the one door.
- Maker-checker / re-OTP for spends: deferred past v1 unless partners demand it.
- SumUp / MercadoPago-class card rail for Checkout: follow-up shared by merchants + NGOs — out of scope for this initiative.
- Instawards sprint close (2026-08-28): W3 submitted as Sozu Wallet + PizzaToken QR/NFC analog, not Stellar Passport / Coffee Tokens. W4 is **Store reconciliation (v1)** on existing POS CLP charges, not a Coffee Token settlement engine or live peso payout.
- Merchant Pollar cutover: **accepted**. New Users: **Pollar login**. Passkey / PIN: existing-account recovery. `/` is a **neutral door**. `/merchants` redirects to `/`. Org type chosen once at create (**Store with POS** / **Distribution platform**).
- ADR recorded: `docs/adr/0001-pollar-for-ngo-staff.md` (NGO Pollar). Merchant-stay-on-passkey clause superseded by `docs/adr/0002-one-pollar-door-org-type-at-create.md`.
