alter table public.local_business_leads
add column if not exists enrichment_diagnostics jsonb not null default '{}'::jsonb,
add column if not exists enrichment_status text not null default 'not_started',
add column if not exists enriched_at timestamptz;
