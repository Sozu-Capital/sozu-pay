-- Passkey-sealed Stellar export blobs. The server cannot decrypt these.
create table if not exists org_passkey_exports (
  org_id uuid primary key references organizations(id) on delete cascade,
  blob text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table org_passkey_exports enable row level security;
