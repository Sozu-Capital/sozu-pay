-- Recipients table bank fields for merchant payouts
-- Add bank account information to recipients

ALTER TABLE recipients ADD COLUMN IF NOT EXISTS bank_holder TEXT;
ALTER TABLE recipients ADD COLUMN IF NOT EXISTS bank_country TEXT;
ALTER TABLE recipients ADD COLUMN IF NOT EXISTS bank_currency TEXT;
ALTER TABLE recipients ADD COLUMN IF NOT EXISTS bank_account_number TEXT;
ALTER TABLE recipients ADD COLUMN IF NOT EXISTS bank_routing_code TEXT;

-- Comments
COMMENT ON COLUMN recipients.bank_holder IS 'Account holder name for bank transfers';
COMMENT ON COLUMN recipients.bank_country IS 'Bank country code (2-letter)';
COMMENT ON COLUMN recipients.bank_currency IS 'Bank account currency (3-letter)';
COMMENT ON COLUMN recipients.bank_account_number IS 'Account number or IBAN';
COMMENT ON COLUMN recipients.bank_routing_code IS 'Routing, sort, or CLABE code';
