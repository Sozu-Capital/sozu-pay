-- Per-account portraits. Null means the UI shows initials, never a shared brand mark.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;
