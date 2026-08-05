# NGO passkey test-data reset

One-shot ops tool for the **Pollar clean break**. Existing NGO dashboard rows are treated as test data; this script removes NGO (`organizations.type = 'ngo'`) passkey / smart-account ghost data so new Pollar onboarding is not polluted. There is **no** user-facing migration wizard.

Merchants (`type = 'store'`) are never selected.

## When to run

- Before enabling NGO Google **Pollar login** in a shared Supabase project that already has passkey NGO test orgs.
- After a deliberate wipe of NGO test accounts (staging / local).
- **Not** on a production merchant-only dataset unless you intentionally also wipe NGO test orgs there.

## What it deletes

For matching NGO orgs only:

| Target | Behavior |
|--------|----------|
| `organizations` (`type = 'ngo'`) | Deleted |
| `smart_accounts`, `webauthn_credentials`, `org_invites` | Deleted by `org_id` when the table exists |
| `org_members` | Deleted by `org_id` when the table exists (some environments use `users.org_id` only) |
| `disbursement_signing_sessions`, SDP meta / checkout rows scoped by `org_id` | Deleted when present |
| Users whose primary `org_id` is a target NGO (and who are not also on a `store` org) | Deleted (cascades `auth_passkeys` when FK is present) |
| Users also in a `store` org | **Kept**; `users.org_id` cleared if it pointed at a deleted NGO |

Missing optional tables are skipped with a log line — the script must still be safe on projects that never applied `org_members`.

## What it does **not** touch

- Any `organizations` row with `type = 'store'`
- Passkeys / PINs for users who still belong to a store org
- Pollar-mapped users created after the clean break (they will not exist until ticket #3+)

## Usage

Requires service role in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=…
SUPABASE_SERVICE_ROLE_KEY=…
```

```bash
# Dry-run (default) — prints counts, deletes nothing
node scripts/reset-ngo-passkey-test-data.mjs

# Narrow scope
node scripts/reset-ngo-passkey-test-data.mjs --org-id=<uuid>
node scripts/reset-ngo-passkey-test-data.mjs --name-prefix=test-

# Destructive
node scripts/reset-ngo-passkey-test-data.mjs --confirm
```

Abort conditions: selection somehow includes a non-`ngo` org; missing Supabase env.

## Safety notes

- Always dry-run first and read the printed org list.
- Prefer `--org-id` / `--name-prefix` on shared environments.
- Irreversible without a database backup / point-in-time recovery.
