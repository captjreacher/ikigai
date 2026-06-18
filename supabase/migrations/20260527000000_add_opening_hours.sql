-- Add opening_hours to local_business_leads for structured hours from Google Places
-- Part of local-business-enrichment-v2

begin;

alter table public.local_business_leads
  add column if not exists opening_hours jsonb;

comment on column public.local_business_leads.opening_hours is
  'Structured opening hours from Google Business Profile or official website. JSON shape: { weekday_descriptions: string[], periods?: object[] }.';

commit;
