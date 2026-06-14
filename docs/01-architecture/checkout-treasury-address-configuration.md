# Checkout Treasury Address Configuration

## Overview

This document provides SQL commands to configure treasury smart account addresses for organizations. These addresses are used by the credit side to determine where to send payments instead of using the checkout session destination address.

**IMPORTANT**: The `treasury_smart_account_address` column must be set in the database for checkout payments to use the treasury C address instead of the classic G address. Without this configuration, payments will default to the classic G address.

## SQL Configuration

### Update treasury address for a specific organization

Replace `org_123` with your actual organization ID and `CCVXRJR3WR4Y33J527JECXILVFDQEGCPBUQOYVGQDSJUKJOPVAKUSIWX` with your treasury smart account address:

```sql
UPDATE organizations
SET treasury_smart_account_address = 'CCVXRJR3WR4Y33J527JECXILVFDQEGCPBUQOYVGQDSJUKJOPVAKUSIWX'
WHERE id = 'org_123';
```

### Verify the configuration

After updating, verify the treasury addresses are set correctly:

```sql
SELECT id, name, treasury_smart_account_address, stellar_disbursement_public_key, soroban_contract_id
FROM organizations
WHERE id = 'org_123';
```

### Update treasury addresses for multiple organizations

If you have multiple organizations, you can update them in a single query:

```sql
UPDATE organizations
SET treasury_smart_account_address = CASE
  WHEN id = 'org_123' THEN 'CCVXRJR3WR4Y33J527JECXILVFDQEGCPBUQOYVGQDSJUKJOPVAKUSIWX'
  WHEN id = 'org_456' THEN 'ANOTHER_SMART_ACCOUNT_ADDRESS_HERE'
  WHEN id = 'org_789' THEN 'YET_ANOTHER_ADDRESS_HERE'
  ELSE treasury_smart_account_address
END
WHERE id IN ('org_123', 'org_456', 'org_789');
```

### Verify the configuration

After updating, verify the treasury addresses are set correctly:

```sql
SELECT id, name, treasury_smart_account_address
FROM organizations
WHERE treasury_smart_account_address IS NOT NULL;
```

## How it works

1. Credit side fetches checkout session from sozupay
2. If `organizationId` is present in the checkout session response, credit side calls `/api/organization/treasury-address?organizationId=org_123`
3. API fetches `treasury_smart_account_address` from organizations table
4. Payment is sent to the fetched treasury address instead of the checkout session destination
5. UI displays the fetched treasury address

## Fallback behavior

- If `organizationId` is missing or treasury address fetch fails, payment uses the checkout session destination
- This ensures the payment still works even if the new setup isn't complete

## Migration steps

1. Run the database migration: `supabase/migrations/20250614000001_add_treasury_smart_account_address.sql`
2. Configure treasury addresses for each organization using the SQL above
3. The checkout session API now includes `organizationId` in the response
4. The credit side can fetch treasury addresses via `/api/organization/treasury-address?organizationId=<org_id>`
