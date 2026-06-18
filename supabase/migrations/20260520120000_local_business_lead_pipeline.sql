-- Local Business Lead Pipeline v1 (Helensville / North West Auckland pilot)
--
-- See docs/architecture/local-business-lead-pilot-v1.md for full ADR.
--
-- Hybrid architecture:
--   - 5 canonical tables own current state for operator-curated outbound prospecting
--   - lifecycle transitions mirror into public.events (strategic ledger) and
--     public.local_business_lead_events (local debug log) via DB-side trigger glue
--
-- Manual-only outreach: setting outreach_drafts.status='sent' is operator-asserted.
-- No outbound mailer exists in this platform.
--
-- Additive and idempotent. Safe to re-run.

begin;

-- =============================================================================
-- 1. updated_at trigger function (shared)
-- =============================================================================

create or replace function public.set_local_business_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

comment on function public.set_local_business_updated_at() is
  'Generic updated_at trigger for local_business_* tables. Sets new.updated_at = now() before update.';

-- =============================================================================
-- 2. public.local_business_leads — canonical prospect record
-- =============================================================================

create table if not exists public.local_business_leads (
  id              uuid primary key default gen_random_uuid(),
  business_name   text not null,
  slug            text unique,
  category        text,
  suburb          text,
  region          text default 'Auckland',
  country         text default 'NZ',
  phone           text,
  email           text,
  website_url     text,
  facebook_url    text,
  google_maps_url text,
  status          text not null default 'discovered'
                  check (status in (
                    'discovered',
                    'enriched',
                    'assessed',
                    'review_required',
                    'approved_for_outreach',
                    'outreach_drafted',
                    'outreach_sent',
                    'responded',
                    'converted',
                    'disqualified',
                    'archived'
                  )),
  source          text default 'manual',
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.local_business_leads is
  'Canonical record for operator-curated outbound prospecting. Lifecycle transitions mirror into public.events via trigger.';

create index if not exists local_business_leads_status_idx
  on public.local_business_leads (status);

create index if not exists local_business_leads_slug_idx
  on public.local_business_leads (slug);

create index if not exists local_business_leads_category_idx
  on public.local_business_leads (category);

create index if not exists local_business_leads_suburb_idx
  on public.local_business_leads (suburb);

drop trigger if exists trg_local_business_leads_updated_at on public.local_business_leads;
create trigger trg_local_business_leads_updated_at
  before update on public.local_business_leads
  for each row
  execute function public.set_local_business_updated_at();

-- =============================================================================
-- 3. public.local_business_lead_signals — append-only observable signals
-- =============================================================================

create table if not exists public.local_business_lead_signals (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid not null references public.local_business_leads(id) on delete cascade,
  signal_type   text not null,
  signal_value  text,
  confidence    numeric(4,2) default 0.50 check (confidence >= 0 and confidence <= 1),
  source        text default 'manual',
  evidence_url  text,
  notes         text,
  created_at    timestamptz not null default now()
);

comment on table public.local_business_lead_signals is
  'Observable signals about a prospect (facebook_present, website_weak, gbp_misaligned, etc). Append-only.';

create index if not exists local_business_lead_signals_lead_id_idx
  on public.local_business_lead_signals (lead_id);

create index if not exists local_business_lead_signals_signal_type_idx
  on public.local_business_lead_signals (signal_type);

-- =============================================================================
-- 4. public.local_business_lead_assessments — scoring snapshots
-- =============================================================================
--
-- opportunity_score is a generated column:
--   (demand_signal_score * 1.5) + trust_leakage_score
-- Postgres 12+ stored generated column. Deterministic, no trigger needed.

create table if not exists public.local_business_lead_assessments (
  id                          uuid primary key default gen_random_uuid(),
  lead_id                     uuid not null references public.local_business_leads(id) on delete cascade,
  demand_signal_score         integer not null default 0 check (demand_signal_score >= 0),
  trust_leakage_score         integer not null default 0 check (trust_leakage_score >= 0),
  conversion_maturity_score   integer not null default 0 check (conversion_maturity_score >= 0),
  ai_readiness_score          integer not null default 0 check (ai_readiness_score >= 0),
  opportunity_score           numeric(6,2)
                              generated always as
                                ((demand_signal_score::numeric * 1.5) + trust_leakage_score::numeric)
                              stored,
  assessment_summary          text,
  recommended_outreach_angle  text,
  assessed_by                 text default 'system',
  assessed_at                 timestamptz not null default now(),
  created_at                  timestamptz not null default now()
);

comment on table public.local_business_lead_assessments is
  'Scoring snapshots. Each row is a point-in-time assessment. opportunity_score is generated from demand_signal_score and trust_leakage_score.';

comment on column public.local_business_lead_assessments.opportunity_score is
  'Generated: (demand_signal_score * 1.5) + trust_leakage_score';

create index if not exists local_business_lead_assessments_lead_id_idx
  on public.local_business_lead_assessments (lead_id);

create index if not exists local_business_lead_assessments_assessed_at_idx
  on public.local_business_lead_assessments (assessed_at desc);

-- =============================================================================
-- 5. public.local_business_lead_events — local audit/debug log
-- =============================================================================
--
-- Append-only. Trigger functions are the only writers.
-- public.events remains the strategic cross-system ledger.

create table if not exists public.local_business_lead_events (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid references public.local_business_leads(id) on delete set null,
  event_type text not null,
  status     text default 'new',
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.local_business_lead_events is
  'Local debug log of state transitions on local_business_leads, local_business_lead_assessments, and local_business_outreach_drafts. Mirrored to public.events. Append-only via trigger.';

create index if not exists local_business_lead_events_lead_id_idx
  on public.local_business_lead_events (lead_id);

create index if not exists local_business_lead_events_event_type_idx
  on public.local_business_lead_events (event_type);

create index if not exists local_business_lead_events_created_at_idx
  on public.local_business_lead_events (created_at desc);

-- =============================================================================
-- 6. public.local_business_outreach_drafts — human-reviewed outreach queue
-- =============================================================================
--
-- Manual-only: no outbound mailer. status='sent' is operator-asserted.

create table if not exists public.local_business_outreach_drafts (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references public.local_business_leads(id) on delete cascade,
  channel     text not null default 'email'
              check (channel in ('email','sms','phone','social','other')),
  subject     text,
  body        text not null,
  status      text not null default 'draft'
              check (status in (
                'draft',
                'pending_review',
                'approved',
                'rejected',
                'sent',
                'archived'
              )),
  created_by  text default 'system',
  approved_by text,
  approved_at timestamptz,
  sent_at     timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.local_business_outreach_drafts is
  'Operator-reviewed outreach queue. No outbound mailer exists; status=''sent'' is operator-asserted.';

create index if not exists local_business_outreach_drafts_lead_id_idx
  on public.local_business_outreach_drafts (lead_id);

create index if not exists local_business_outreach_drafts_status_idx
  on public.local_business_outreach_drafts (status);

drop trigger if exists trg_local_business_outreach_drafts_updated_at on public.local_business_outreach_drafts;
create trigger trg_local_business_outreach_drafts_updated_at
  before update on public.local_business_outreach_drafts
  for each row
  execute function public.set_local_business_updated_at();

-- =============================================================================
-- 7. Event emission helper — writes to local debug log AND public.events
-- =============================================================================
--
-- Risk classification mirrors src/events/risk-map.ts entries for local_business.*.
-- All local_business.* events are category='business_process', version='risk-map-v1'.

create or replace function public.emit_local_business_event(
  p_lead_id    uuid,
  p_event_type text,
  p_status     text default 'new',
  p_payload    jsonb default '{}'::jsonb,
  p_entity_ref text default null
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_risk_category   text := 'business_process';
  v_risk_assertions text[];
  v_risk_version    text := 'risk-map-v1';
begin
  -- Deterministic risk classification (mirrors src/events/risk-map.ts)
  case p_event_type
    when 'local_business.discovered'           then v_risk_assertions := array['input'];
    when 'local_business.enriched'             then v_risk_assertions := array['input','processing'];
    when 'local_business.assessed'             then v_risk_assertions := array['processing'];
    when 'local_business.scored'               then v_risk_assertions := array['processing'];
    when 'local_business.review_requested'     then v_risk_assertions := array['processing'];
    when 'local_business.approved_for_outreach' then v_risk_assertions := array['processing','access'];
    when 'local_business.outreach_drafted'     then v_risk_assertions := array['processing'];
    when 'local_business.outreach_approved'    then v_risk_assertions := array['processing','access'];
    when 'local_business.outreach_sent'        then v_risk_assertions := array['access','processing'];
    when 'local_business.responded'            then v_risk_assertions := array['input','processing'];
    when 'local_business.converted'            then v_risk_assertions := array['processing'];
    when 'local_business.disqualified'         then v_risk_assertions := array['rejection','processing'];
    when 'local_business.archived'             then v_risk_assertions := array['rejection'];
    else
      -- Unknown event type — leave risk fields null, do not block
      v_risk_category   := null;
      v_risk_assertions := null;
      v_risk_version    := null;
  end case;

  -- Local debug log
  insert into public.local_business_lead_events (lead_id, event_type, status, payload)
  values (p_lead_id, p_event_type, p_status, p_payload);

  -- Strategic ledger
  insert into public.events (
    source_system, event_type, entity_type, entity_id, entity_ref, status, payload,
    risk_category, risk_assertions, risk_version
  ) values (
    'local_business_pipeline',
    p_event_type,
    'local_business_lead',
    p_lead_id,
    p_entity_ref,
    p_status,
    p_payload,
    v_risk_category,
    v_risk_assertions,
    v_risk_version
  );
end;
$$;

comment on function public.emit_local_business_event(uuid, text, text, jsonb, text) is
  'Writes a local_business.* event to both public.local_business_lead_events (debug log) and public.events (strategic ledger), with deterministic risk classification. SECURITY DEFINER so triggers can insert into RLS-protected tables.';

-- Tighten access on the helper. Triggers call it via PERFORM under the table-owner's
-- privileges, but direct callers are restricted to anon/authenticated/service_role.
revoke execute on function public.emit_local_business_event(uuid, text, text, jsonb, text) from public;
grant  execute on function public.emit_local_business_event(uuid, text, text, jsonb, text) to anon, authenticated, service_role;

-- =============================================================================
-- 8. Trigger: leads INSERT -> local_business.discovered
-- =============================================================================

create or replace function public.local_business_leads_after_insert()
returns trigger as $$
begin
  perform public.emit_local_business_event(
    new.id,
    'local_business.' ||
      case new.status
        when 'review_required' then 'review_requested'
        else new.status
      end,
    new.status,
    jsonb_strip_nulls(jsonb_build_object(
      'business_name', new.business_name,
      'slug',          new.slug,
      'category',      new.category,
      'suburb',        new.suburb,
      'region',        new.region,
      'country',       new.country,
      'source',        new.source
    )),
    new.slug
  );
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_local_business_leads_after_insert on public.local_business_leads;
create trigger trg_local_business_leads_after_insert
  after insert on public.local_business_leads
  for each row
  execute function public.local_business_leads_after_insert();

-- =============================================================================
-- 9. Trigger: leads UPDATE OF status -> local_business.<status>
-- =============================================================================

create or replace function public.local_business_leads_after_status_change()
returns trigger as $$
declare
  v_event_type text;
begin
  if new.status is distinct from old.status then
    v_event_type := 'local_business.' ||
      case new.status
        when 'review_required' then 'review_requested'
        else new.status
      end;

    perform public.emit_local_business_event(
      new.id,
      v_event_type,
      new.status,
      jsonb_strip_nulls(jsonb_build_object(
        'business_name', new.business_name,
        'slug',          new.slug,
        'prior_status',  old.status,
        'new_status',    new.status
      )),
      new.slug
    );
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_local_business_leads_after_status_change on public.local_business_leads;
create trigger trg_local_business_leads_after_status_change
  after update of status on public.local_business_leads
  for each row
  execute function public.local_business_leads_after_status_change();

-- =============================================================================
-- 10. Trigger: assessments INSERT -> local_business.scored
-- =============================================================================

create or replace function public.local_business_lead_assessments_after_insert()
returns trigger as $$
begin
  perform public.emit_local_business_event(
    new.lead_id,
    'local_business.scored',
    'scored',
    jsonb_strip_nulls(jsonb_build_object(
      'assessment_id',             new.id,
      'demand_signal_score',       new.demand_signal_score,
      'trust_leakage_score',       new.trust_leakage_score,
      'conversion_maturity_score', new.conversion_maturity_score,
      'ai_readiness_score',        new.ai_readiness_score,
      'opportunity_score',         new.opportunity_score,
      'recommended_outreach_angle', new.recommended_outreach_angle,
      'assessed_by',               new.assessed_by
    )),
    null
  );
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_local_business_lead_assessments_after_insert on public.local_business_lead_assessments;
create trigger trg_local_business_lead_assessments_after_insert
  after insert on public.local_business_lead_assessments
  for each row
  execute function public.local_business_lead_assessments_after_insert();

-- =============================================================================
-- 11. Trigger: outreach drafts INSERT -> local_business.outreach_drafted
-- =============================================================================

create or replace function public.local_business_outreach_drafts_after_insert()
returns trigger as $$
begin
  perform public.emit_local_business_event(
    new.lead_id,
    'local_business.outreach_drafted',
    new.status,
    jsonb_strip_nulls(jsonb_build_object(
      'draft_id',   new.id,
      'channel',    new.channel,
      'subject',    new.subject,
      'created_by', new.created_by
    )),
    null
  );
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_local_business_outreach_drafts_after_insert on public.local_business_outreach_drafts;
create trigger trg_local_business_outreach_drafts_after_insert
  after insert on public.local_business_outreach_drafts
  for each row
  execute function public.local_business_outreach_drafts_after_insert();

-- =============================================================================
-- 12. Trigger: outreach drafts UPDATE OF status -> approved / sent events
-- =============================================================================
--
-- status='sent' is operator-asserted. Trigger emits the event but does not
-- transmit anything. Payload records manual=true and sent_by for audit.

create or replace function public.local_business_outreach_drafts_after_status_change()
returns trigger as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'approved' then
      perform public.emit_local_business_event(
        new.lead_id,
        'local_business.outreach_approved',
        new.status,
        jsonb_strip_nulls(jsonb_build_object(
          'draft_id',    new.id,
          'channel',     new.channel,
          'approved_by', new.approved_by,
          'approved_at', new.approved_at
        )),
        null
      );
    elsif new.status = 'sent' then
      perform public.emit_local_business_event(
        new.lead_id,
        'local_business.outreach_sent',
        new.status,
        jsonb_strip_nulls(jsonb_build_object(
          'draft_id',    new.id,
          'channel',     new.channel,
          'sent_by',     coalesce(new.approved_by, new.created_by),
          'sent_at',     new.sent_at,
          'manual',      true
        )),
        null
      );
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_local_business_outreach_drafts_after_status_change on public.local_business_outreach_drafts;
create trigger trg_local_business_outreach_drafts_after_status_change
  after update of status on public.local_business_outreach_drafts
  for each row
  execute function public.local_business_outreach_drafts_after_status_change();

-- =============================================================================
-- 13. RLS — enable and policy
-- =============================================================================
--
-- SELECT to authenticated. INSERT/UPDATE/DELETE to authenticated on the four
-- operator-editable canonical tables. local_business_lead_events is read-only
-- for authenticated — only triggers write to it.

alter table public.local_business_leads              enable row level security;
alter table public.local_business_lead_signals       enable row level security;
alter table public.local_business_lead_assessments   enable row level security;
alter table public.local_business_lead_events        enable row level security;
alter table public.local_business_outreach_drafts    enable row level security;

-- local_business_leads
drop policy if exists "authenticated read leads"   on public.local_business_leads;
drop policy if exists "authenticated write leads"  on public.local_business_leads;
drop policy if exists "authenticated update leads" on public.local_business_leads;
drop policy if exists "authenticated delete leads" on public.local_business_leads;

create policy "authenticated read leads"
  on public.local_business_leads for select to authenticated using (true);
create policy "authenticated write leads"
  on public.local_business_leads for insert to authenticated with check (true);
create policy "authenticated update leads"
  on public.local_business_leads for update to authenticated using (true) with check (true);
create policy "authenticated delete leads"
  on public.local_business_leads for delete to authenticated using (true);

-- local_business_lead_signals
drop policy if exists "authenticated read signals"   on public.local_business_lead_signals;
drop policy if exists "authenticated write signals"  on public.local_business_lead_signals;
drop policy if exists "authenticated update signals" on public.local_business_lead_signals;
drop policy if exists "authenticated delete signals" on public.local_business_lead_signals;

create policy "authenticated read signals"
  on public.local_business_lead_signals for select to authenticated using (true);
create policy "authenticated write signals"
  on public.local_business_lead_signals for insert to authenticated with check (true);
create policy "authenticated update signals"
  on public.local_business_lead_signals for update to authenticated using (true) with check (true);
create policy "authenticated delete signals"
  on public.local_business_lead_signals for delete to authenticated using (true);

-- local_business_lead_assessments
drop policy if exists "authenticated read assessments"   on public.local_business_lead_assessments;
drop policy if exists "authenticated write assessments"  on public.local_business_lead_assessments;
drop policy if exists "authenticated update assessments" on public.local_business_lead_assessments;
drop policy if exists "authenticated delete assessments" on public.local_business_lead_assessments;

create policy "authenticated read assessments"
  on public.local_business_lead_assessments for select to authenticated using (true);
create policy "authenticated write assessments"
  on public.local_business_lead_assessments for insert to authenticated with check (true);
create policy "authenticated update assessments"
  on public.local_business_lead_assessments for update to authenticated using (true) with check (true);
create policy "authenticated delete assessments"
  on public.local_business_lead_assessments for delete to authenticated using (true);

-- local_business_lead_events (read-only — only triggers write)
drop policy if exists "authenticated read lead events" on public.local_business_lead_events;
create policy "authenticated read lead events"
  on public.local_business_lead_events for select to authenticated using (true);

-- local_business_outreach_drafts
drop policy if exists "authenticated read drafts"   on public.local_business_outreach_drafts;
drop policy if exists "authenticated write drafts"  on public.local_business_outreach_drafts;
drop policy if exists "authenticated update drafts" on public.local_business_outreach_drafts;
drop policy if exists "authenticated delete drafts" on public.local_business_outreach_drafts;

create policy "authenticated read drafts"
  on public.local_business_outreach_drafts for select to authenticated using (true);
create policy "authenticated write drafts"
  on public.local_business_outreach_drafts for insert to authenticated with check (true);
create policy "authenticated update drafts"
  on public.local_business_outreach_drafts for update to authenticated using (true) with check (true);
create policy "authenticated delete drafts"
  on public.local_business_outreach_drafts for delete to authenticated using (true);

-- =============================================================================
-- 14. public.local_business_lead_pipeline_view — Cockpit-facing
-- =============================================================================

create or replace view public.local_business_lead_pipeline_view as
select
  l.id                                as lead_id,
  l.business_name,
  l.category,
  l.suburb,
  l.status,
  l.website_url,
  l.facebook_url,
  l.google_maps_url,
  a.demand_signal_score,
  a.trust_leakage_score,
  a.conversion_maturity_score,
  a.ai_readiness_score,
  a.opportunity_score,
  a.recommended_outreach_angle,
  a.assessment_summary,
  a.assessed_at                       as latest_assessment_at,
  e.event_type                        as latest_event_type,
  e.created_at                        as latest_event_at
from public.local_business_leads l
left join lateral (
  select
    demand_signal_score,
    trust_leakage_score,
    conversion_maturity_score,
    ai_readiness_score,
    opportunity_score,
    recommended_outreach_angle,
    assessment_summary,
    assessed_at
  from public.local_business_lead_assessments
  where lead_id = l.id
  order by assessed_at desc nulls last, created_at desc
  limit 1
) a on true
left join lateral (
  select event_type, created_at
  from public.local_business_lead_events
  where lead_id = l.id
  order by created_at desc
  limit 1
) e on true;

comment on view public.local_business_lead_pipeline_view is
  'Cockpit-facing pipeline view: each lead with its latest assessment scores and latest event. Source: docs/architecture/local-business-lead-pilot-v1.md.';

grant select on public.local_business_lead_pipeline_view to authenticated;

commit;
