alter table public.local_business_leads
  add column if not exists enrichment_status text,
  add column if not exists enriched_at timestamptz,
  add column if not exists enrichment_error text,
  add column if not exists enrichment_confidence numeric,
  add column if not exists enrichment_payload jsonb default '{}'::jsonb;
