-- Cockpit Signals Queue access and operational indexes.

begin;

comment on table public.social_engagement_signals is
  'Durable operational queue for social engagement signals captured from Meta webhooks before lead promotion.';

create unique index if not exists social_engagement_signals_external_event_key
  on public.social_engagement_signals (source_platform, external_event_id)
  where external_event_id is not null;

create unique index if not exists social_engagement_signals_comment_key
  on public.social_engagement_signals (source_platform, comment_id)
  where comment_id is not null;

create unique index if not exists social_engagement_signals_message_key
  on public.social_engagement_signals (source_platform, message_id)
  where message_id is not null;

create index if not exists social_engagement_signals_created_at_idx
  on public.social_engagement_signals (created_at desc);

create index if not exists social_engagement_signals_intent_idx
  on public.social_engagement_signals (intent_label, intent_score desc);

grant select, update on public.social_engagement_signals to anon, authenticated;
grant insert on public.social_engagement_signals to authenticated;

drop policy if exists "Cockpit can read social engagement signals" on public.social_engagement_signals;
drop policy if exists "Cockpit can update social engagement signal workflow state" on public.social_engagement_signals;
drop policy if exists "authenticated can insert social engagement signals" on public.social_engagement_signals;

create policy "Cockpit can read social engagement signals"
  on public.social_engagement_signals
  for select
  to anon, authenticated
  using (true);

create policy "Cockpit can update social engagement signal workflow state"
  on public.social_engagement_signals
  for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "authenticated can insert social engagement signals"
  on public.social_engagement_signals
  for insert
  to authenticated
  with check (true);

commit;
