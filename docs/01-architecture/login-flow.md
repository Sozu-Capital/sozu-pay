# Login flow

## Overview

1. **Visit /** – Home is the login gate. Session is kept by default; **`/?fresh=1`** (after logout) clears the session cookie.
2. **Log in (passkey, default)** – Sozu tag + WebAuthn passkey, or tag + backup PIN. See [passkey-auth-migration.md](./passkey-auth-migration.md).
3. **Log in (Privy, legacy)** – Privy modal → `POST /api/auth/privy` → `sozupay_session` cookie.
4. **Organization picker** – Client redirects to `/onboarding/organizations`. User sees:
   - **Organizations they can access** – “Continue to dashboard” sets the current org in session and goes to dashboard.
   - **Create new organization** – Shown if super_admin with no org (or always for super_admin); links to `/onboarding/create-organization`. After creating, they return to the org picker and select the new org.
   - **No access** – If they have no orgs and cannot create, they see “Contact your administrator” and Log out.
5. **Dashboard** – After selecting an org (or creating one and selecting it), session includes `orgId` and the user is on the dashboard. Balance, tx history, and DeFi are for the **organization wallet**.
6. **Logout** – Clears session and redirects to `/?fresh=1`. Legacy `/login` redirects to `/`.

## APIs

- **GET /api/auth/clear-session** – Clears the session cookie (no redirect). Called by the login page on load.
- **POST /api/auth/set-org** – Body `{ orgId }`. Sets `session.orgId` so dashboard uses that organization. User must have access (currently: `user.org_id === orgId`; later: org membership).
- **GET /api/profile/organizations** – Returns `{ organizations: [{ id, name }], canCreate }` for the current user. Used by the org picker.

## Middleware

- **With Privy:** No session → protected routes redirect to `/?returnTo=…`. Logged-in users on `/` go to `/dashboard` unless `?fresh=1`.
- **Mock auth (no Privy, dev):** Session on `/` → redirect to `/dashboard`.

## Session

- Session may include `orgId` (current organization to manage). Set when the user selects an org on the org picker, or auto-set in profile when the user has a single `org_id` and session has no `orgId` yet.
- Dashboard and wallet resolution use `session.orgId ?? user.org_id` for the current org.

## Env

- `NEXT_PUBLIC_PRIVY_APP_ID` – required for login UI.
- `PRIVY_APP_ID` / `PRIVY_VERIFICATION_KEY` – required for `/api/auth/privy` token verification.
- `AUTH_SECRET` – used to sign the session cookie (use a strong value in production).
