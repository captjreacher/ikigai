begin;

create table if not exists public.social_engagement_signals (
  id uuid primary key default gen_random_uuid(),
  source_platform text not null,
  source_system text not null default 'social_meta_webhook',
  signal_type text not null,
  external_event_id text,
  external_actor_id text,
  external_actor_name text,
  page_id text,
  post_id text,
  comment_id text,
  message_id text,
  reaction_type text,
  message_text text,
  intent_score integer,
  intent_label text,
  status text not null default 'captured',
  raw_payload jsonb not null default '{}'::jsonb,
  related_lead_id uuid references public.local_business_leads(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists social_engagement_signals_platform_type_idx
  on public.social_engagement_signals (source_platform, signal_type);

create index if not exists social_engagement_signals_status_created_idx
  on public.social_engagement_signals (status, created_at desc);

create index if not exists social_engagement_signals_actor_idx
  on public.social_engagement_signals (external_actor_id);

drop trigger if exists trg_social_engagement_signals_updated_at on public.social_engagement_signals;
create trigger trg_social_engagement_signals_updated_at
before update on public.social_engagement_signals
for each row execute function public.set_local_business_updated_at();

alter table public.social_engagement_signals enable row level security;

grant select on public.social_engagement_signals to authenticated;

drop policy if exists "authenticated read social engagement signals" on public.social_engagement_signals;
create policy "authenticated read social engagement signals"
  on public.social_engagement_signals for select to authenticated using (true);

commit;
