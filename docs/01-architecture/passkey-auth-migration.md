# Passkey authentication (Privy replacement)

## Overview

Dashboard identity uses **WebAuthn passkeys** + optional **backup PIN** (Sozu Credit pattern). **No Privy** when `AUTH_PROVIDER=passkey` (default if `NEXT_PUBLIC_PRIVY_APP_ID` is unset).

Wallet signing uses **OpenZeppelin Smart Account Kit** (unchanged): each user gets a `member` smart account; each org gets `org_treasury` + disbursement contract via existing onboarding.

## Env

```bash
NEXT_PUBLIC_AUTH_PROVIDER=passkey   # or privy for legacy
NEXT_PUBLIC_RP_ID=localhost         # production: your dashboard hostname
AUTH_SECRET=...                     # session cookie signing
```

Privy (legacy only):

```bash
NEXT_PUBLIC_AUTH_PROVIDER=privy
NEXT_PUBLIC_PRIVY_APP_ID=...
PRIVY_VERIFICATION_KEY=...
```

## Database

Run `docs/07-reference/supabase-passkey-auth.sql`:

- `users.username`, `users.recovery_pin_hash`
- `auth_passkeys` (login credentials; separate from `webauthn_credentials` for Soroban signing)

## Flow

1. **Register** — Sozu tag → passkey → `users` row + `auth_passkeys` → session cookie → onboarding (smart wallet / org).
2. **Login** — passkey discovery or tag + passkey; optional tag + PIN if `recovery_pin_hash` set.
3. **Session** — `sozupay_session` with `id` = numeric `users.id` (legacy Privy sessions still resolve via `privy_user_id`).

## APIs

| Route | Purpose |
|-------|---------|
| `POST /api/auth/register/challenge` | WebAuthn registration options |
| `POST /api/auth/register/verify` | Create user + passkey + session |
| `POST /api/auth/login/challenge` | WebAuthn auth options |
| `POST /api/auth/login/verify` | Verify passkey + session |
| `POST /api/auth/username/check` | Tag availability |
| `POST /api/auth/pin/login` | Tag + backup PIN session |
| `POST /api/auth/pin/set` | Set backup PIN (authenticated) |

## Code map

- `src/lib/auth/passkey-client.ts` — browser WebAuthn
- `src/components/HomePasskeyAuth.tsx` — landing auth UI
- `src/lib/auth/provider.ts` — `passkey` vs `privy`
- `src/components/AppProviders.tsx` — Smart Account Kit + optional Privy
