-- Credit applications, loans, installments, org settings, CRM sync queue, email log.
-- Run in Supabase SQL Editor after organizations and users exist.

-- Staff-editable defaults for the public simulator (TNA = annual nominal %).
CREATE TABLE IF NOT EXISTS org_credit_settings (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  default_annual_rate_pct NUMERIC NOT NULL DEFAULT 36,
  currency TEXT NOT NULL DEFAULT 'USD',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_credit_settings_org ON org_credit_settings(organization_id);

-- Applicant-facing credit request (MUJERES 2000–style flow).
CREATE TABLE IF NOT EXISTS credit_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  applicant_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'under_review', 'approved', 'rejected')),
  requested_principal NUMERIC NOT NULL DEFAULT 0,
  num_installments INT NOT NULL DEFAULT 12,
  annual_rate_pct NUMERIC,
  applicant_profile JSONB NOT NULL DEFAULT '{}',
  simulation JSONB,
  internal_notes TEXT,
  rejection_reason TEXT,
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewer_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_apps_org ON credit_applications(organization_id);
CREATE INDEX IF NOT EXISTS idx_credit_apps_applicant ON credit_applications(applicant_user_id);
CREATE INDEX IF NOT EXISTS idx_credit_apps_status ON credit_applications(organization_id, status);

-- Approved loan (agreement).
CREATE TABLE IF NOT EXISTS credit_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES credit_applications(id) ON DELETE CASCADE,
  applicant_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES recipients(id) ON DELETE SET NULL,
  principal NUMERIC NOT NULL,
  annual_rate_pct NUMERIC NOT NULL,
  num_installments INT NOT NULL,
  start_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_agreements_one_per_app ON credit_agreements(application_id);
CREATE INDEX IF NOT EXISTS idx_credit_agreements_org ON credit_agreements(organization_id);
CREATE INDEX IF NOT EXISTS idx_credit_agreements_user ON credit_agreements(applicant_user_id);

CREATE TABLE IF NOT EXISTS installment_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES credit_agreements(id) ON DELETE CASCADE,
  installment_no INT NOT NULL,
  due_date DATE NOT NULL,
  principal_due NUMERIC NOT NULL,
  interest_due NUMERIC NOT NULL,
  total_due NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid', 'late')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (loan_id, installment_no)
);

CREATE INDEX IF NOT EXISTS idx_installment_loan ON installment_schedule(loan_id);
CREATE INDEX IF NOT EXISTS idx_installment_due ON installment_schedule(due_date);

CREATE TABLE IF NOT EXISTS repayment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES credit_agreements(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  method TEXT,
  stellar_tx_hash TEXT,
  confirmed_by_staff BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_repayment_loan ON repayment_events(loan_id);

-- Idempotent product emails (e.g. one "approved" per application).
CREATE TABLE IF NOT EXISTS credit_email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES credit_applications(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (application_id, kind)
);

-- Salesforce (or other CRM) outbound sync queue.
CREATE TABLE IF NOT EXISTS crm_sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_crm_queue_status ON crm_sync_queue(status, created_at);

-- Optional: recipients.phone used by payout / credit flows
ALTER TABLE recipients ADD COLUMN IF NOT EXISTS phone TEXT;
