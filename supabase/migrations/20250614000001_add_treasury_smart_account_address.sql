-- Add treasury_smart_account_address column to organizations table
-- This column stores the smart account address for organization treasury payments
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS treasury_smart_account_address TEXT;
