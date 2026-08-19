# Database Migration Guide - Merchants Route Setup

This guide walks you through setting up all required database tables for the merchants feature.

## Prerequisites

- Access to your Supabase project dashboard
- SQL Editor access in Supabase

## Migration Order

Run these migrations **in order** in the Supabase SQL Editor:

### Step 1: Verify Base Tables Exist

First, check that these base tables already exist (they should from previous setups):
- `organizations`
- `users`
- `recipients`

If any are missing, run their base migrations first:
- `supabase-organizations-table.sql`
- `supabase-users-table.sql`
- `supabase-recipients-table.sql`

### Step 2: Create Checkout Sessions Base Table

**File:** `docs/07-reference/supabase-checkout-sessions-base.sql`

This creates the base `checkout_sessions` table for payment links.

```sql
-- Run this first if checkout_sessions doesn't exist
```

**Expected output:** "Success. No rows returned"

### Step 3: Add Merchant Checkout Enhancements

**File:** `docs/07-reference/supabase-checkout-sessions-merchant.sql`

Adds payment method toggles and soft delete support.

**Expected output:** "Success. No rows returned"

### Step 4: Add Recipient Bank Fields

**File:** `docs/07-reference/supabase-recipients-bank.sql`

Adds bank account fields to the recipients table.

**Expected output:** "Success. No rows returned"

### Step 5: Create Merchant QR Points Table

**File:** `docs/07-reference/supabase-merchant-qr-points.sql`

Creates the table for managing QR code payment points.

**Expected output:** "Success. No rows returned"

### Step 6: Create Merchant POS Devices Table

**File:** `docs/07-reference/supabase-merchant-pos-devices.sql`

Creates the table for managing POS terminals and NFC devices.

**Expected output:** "Success. No rows returned"

### Step 7: QR point channel (QR vs NFC)

**File:** `docs/07-reference/supabase-merchant-qr-points-point-type.sql`

Adds `point_type` (`qr` | `nfc`) on `merchant_qr_points` — both use the same `/pay/qr/{slug}` URL.

### Step 7b: Standing pizza SKU destination

**File:** `docs/07-reference/supabase-merchant-qr-points-pizza-sku.sql`

Extends `destination_type` with `pizza_sku`. `/pay/qr/{slug}` stays a standing Margherita offer and never completes a `checkout_sessions` row.

### Step 8: Merchant off-ramp withdrawal queue

**File:** `docs/07-reference/supabase-withdrawal-requests-ramp.sql`

Creates `withdrawal_requests` for store USDC → bank CLP off-ramp (manual admin fulfillment POC).

**Note:** If you already use shadow-ledger `withdrawal_requests`, resolve schema conflict before running this migration.

## Quick Migration Script

If you prefer to run all at once, copy this into Supabase SQL Editor:

```sql
-- Step 1: Base checkout_sessions table
-- (paste contents of supabase-checkout-sessions-base.sql)

-- Step 2: Merchant checkout enhancements
-- (paste contents of supabase-checkout-sessions-merchant.sql)

-- Step 3: Recipient bank fields
-- (paste contents of supabase-recipients-bank.sql)

-- Step 4: Merchant QR points
-- (paste contents of supabase-merchant-qr-points.sql)

-- Step 5: Merchant POS devices
-- (paste contents of supabase-merchant-pos-devices.sql)
```

## Verification Queries

After running all migrations, verify with these queries:

```sql
-- Check checkout_sessions table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'checkout_sessions' 
ORDER BY ordinal_position;

-- Check recipients has bank fields
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'recipients' 
  AND column_name LIKE 'bank_%';

-- Check merchant tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('merchant_qr_points', 'merchant_pos_devices');
```

## Testing the Setup

After migrations are complete:

1. **Test Merchants Landing:**
   - Visit `http://localhost:3000/merchants`
   - Should show merchant-focused copy
   - Create a test account through this route

2. **Test Checkout Creation:**
   - Navigate to `/dashboard/checkout`
   - Create a payment link with payment method toggles
   - Verify preview appears
   - Try editing and deleting

3. **Test QR Codes:**
   - Navigate to `/dashboard/qr-codes`
   - Create a QR point
   - Toggle online/offline status

4. **Test POS Registry:**
   - Navigate to `/dashboard/pos`
   - Add a POS or NFC device
   - Verify type badges display

5. **Test Recipients with Bank:**
   - Navigate to `/dashboard/recipients`
   - Add a recipient with bank details
   - Verify bank fields are optional and save correctly

## Troubleshooting

### Error: "relation X does not exist"
- Run the base table migration first (step 1)
- Verify the table exists: `SELECT * FROM X LIMIT 1;`

### Error: "column X already exists"
- Safe to ignore - the migrations use `IF NOT EXISTS`
- The migration is idempotent

### Error: "foreign key violation"
- Ensure `organizations` table exists first
- Check that you're logged in with a valid org

### Development Server Issues
- Restart: `npm run dev`
- Clear Next.js cache: `rm -rf .next`
- Check environment variables in `.env.local`

## Rollback (if needed)

To rollback the merchant features:

```sql
-- Remove merchant tables
DROP TABLE IF EXISTS merchant_pos_devices CASCADE;
DROP TABLE IF EXISTS merchant_qr_points CASCADE;

-- Remove merchant checkout columns
ALTER TABLE checkout_sessions DROP COLUMN IF EXISTS payment_method;
ALTER TABLE checkout_sessions DROP COLUMN IF EXISTS allow_debit;
ALTER TABLE checkout_sessions DROP COLUMN IF EXISTS allow_credit;
ALTER TABLE checkout_sessions DROP COLUMN IF EXISTS allow_bank_transfer;
ALTER TABLE checkout_sessions DROP COLUMN IF EXISTS deleted_at;

-- Remove recipient bank columns
ALTER TABLE recipients DROP COLUMN IF EXISTS bank_holder;
ALTER TABLE recipients DROP COLUMN IF EXISTS bank_country;
ALTER TABLE recipients DROP COLUMN IF EXISTS bank_currency;
ALTER TABLE recipients DROP COLUMN IF EXISTS bank_account_number;
ALTER TABLE recipients DROP COLUMN IF EXISTS bank_routing_code;
```
