-- Add derived risk metadata to public.events.
-- These columns support deterministic, versioned risk classification over the event stream.
-- Safe to run multiple times.

alter table if exists public.events
  add column if not exists risk_category text,
  add column if not exists risk_assertions text[] default '{}',
  add column if not exists risk_version text;

comment on column public.events.risk_category is
  'Derived risk category for the event. Expected values: business_process, environment_internal, environment_external.';

comment on column public.events.risk_assertions is
  'Derived risk assertions for the event. Values depend on risk_category and are versioned by risk_version.';

comment on column public.events.risk_version is
  'Version of the deterministic risk mapping used to classify this event.';

create index if not exists events_risk_category_idx
  on public.events (risk_category);

create index if not exists events_risk_version_idx
  on public.events (risk_version);

create index if not exists events_risk_assertions_gin_idx
  on public.events using gin (risk_assertions);
