-- Local Business Lead Pilot — extend DB-side risk classification
--
-- During staging-apply on mgrnz-web, the local_business.* events written into
-- public.events came through with NULL risk_category / risk_assertions / risk_version
-- because the BEFORE INSERT triggers (trg_apply_event_canonical_and_risk +
-- trg_apply_event_taxonomy_defaults) overwrote the helper-supplied values from
-- canonical hardcoded SQL functions that didn't recognize local_business.*.
--
-- This migration extends event_risk_category() and event_risk_assertions() with
-- the 13 local_business.* entries so new events get classified correctly
-- (risk_version='risk-map-v1', matching the application-layer src/events/risk-map.ts).
--
-- It also backfills the existing 25 events written by the pilot seed.
--
-- Additive. Safe to re-run.

begin;

-- =============================================================================
-- 1. Extend event_risk_category() with local_business.* entries
-- =============================================================================

create or replace function public.event_risk_category(canonical text)
returns text
language sql
immutable
as $function$
  select case canonical
    when 'lead.captured' then 'business_process'
    when 'lead.validated' then 'business_process'
    when 'lead.enriched' then 'business_process'
    when 'lead.invalid' then 'business_process'
    when 'lead.duplicate' then 'business_process'

    when 'opportunity.created' then 'business_process'
    when 'opportunity.qualified' then 'business_process'
    when 'opportunity.disqualified' then 'business_process'
    when 'opportunity.proposed' then 'business_process'
    when 'opportunity.won' then 'business_process'
    when 'opportunity.lost' then 'business_process'

    when 'content.requested' then 'business_process'
    when 'content.generated' then 'business_process'
    when 'content.reviewed' then 'business_process'
    when 'content.approved' then 'business_process'
    when 'content.rejected' then 'business_process'
    when 'content.published' then 'business_process'

    when 'engagement.started' then 'business_process'
    when 'engagement.milestone.reached' then 'business_process'
    when 'engagement.blocked' then 'business_process'
    when 'engagement.resumed' then 'business_process'
    when 'engagement.completed' then 'business_process'
    when 'engagement.cancelled' then 'business_process'

    -- local_business.* — outbound prospecting (added 2026-05-20, see
    -- docs/architecture/local-business-lead-pilot-v1.md)
    when 'local_business.discovered' then 'business_process'
    when 'local_business.enriched' then 'business_process'
    when 'local_business.assessed' then 'business_process'
    when 'local_business.scored' then 'business_process'
    when 'local_business.review_requested' then 'business_process'
    when 'local_business.approved_for_outreach' then 'business_process'
    when 'local_business.outreach_drafted' then 'business_process'
    when 'local_business.outreach_approved' then 'business_process'
    when 'local_business.outreach_sent' then 'business_process'
    when 'local_business.responded' then 'business_process'
    when 'local_business.converted' then 'business_process'
    when 'local_business.disqualified' then 'business_process'
    when 'local_business.archived' then 'business_process'

    when 'paperclip.issue.created' then 'business_process'
    when 'paperclip.issue.assigned' then 'business_process'
    when 'paperclip.issue.in_progress' then 'business_process'
    when 'paperclip.issue.blocked' then 'business_process'
    when 'paperclip.issue.resolved' then 'business_process'
    when 'paperclip.issue.closed' then 'business_process'

    when 'system.error' then 'environment_internal'
    when 'system.timeout' then 'environment_internal'
    when 'system.degraded' then 'environment_internal'
    when 'system.recovered' then 'environment_internal'
    when 'system.retry.requested' then 'environment_internal'
    when 'system.retry.succeeded' then 'environment_internal'
    when 'system.external_signal.detected' then 'environment_external'

    else null
  end
$function$;

-- =============================================================================
-- 2. Extend event_risk_assertions() with local_business.* entries
-- =============================================================================

create or replace function public.event_risk_assertions(canonical text)
returns text[]
language sql
immutable
as $function$
  select case canonical
    when 'lead.captured' then array['input']::text[]
    when 'lead.validated' then array['input', 'processing']::text[]
    when 'lead.enriched' then array['input', 'processing']::text[]
    when 'lead.invalid' then array['rejection', 'input']::text[]
    when 'lead.duplicate' then array['rejection', 'processing']::text[]

    when 'opportunity.created' then array['input', 'processing']::text[]
    when 'opportunity.qualified' then array['processing']::text[]
    when 'opportunity.disqualified' then array['rejection', 'processing']::text[]
    when 'opportunity.proposed' then array['processing', 'access']::text[]
    when 'opportunity.won' then array['processing']::text[]
    when 'opportunity.lost' then array['rejection', 'processing']::text[]

    when 'content.requested' then array['input']::text[]
    when 'content.generated' then array['processing']::text[]
    when 'content.reviewed' then array['processing']::text[]
    when 'content.approved' then array['processing']::text[]
    when 'content.rejected' then array['rejection', 'processing']::text[]
    when 'content.published' then array['access', 'processing']::text[]

    when 'engagement.started' then array['access', 'processing']::text[]
    when 'engagement.milestone.reached' then array['processing']::text[]
    when 'engagement.blocked' then array['rejection', 'processing']::text[]
    when 'engagement.resumed' then array['processing']::text[]
    when 'engagement.completed' then array['processing']::text[]
    when 'engagement.cancelled' then array['rejection', 'processing']::text[]

    -- local_business.* — outbound prospecting (added 2026-05-20)
    when 'local_business.discovered' then array['input']::text[]
    when 'local_business.enriched' then array['input', 'processing']::text[]
    when 'local_business.assessed' then array['processing']::text[]
    when 'local_business.scored' then array['processing']::text[]
    when 'local_business.review_requested' then array['processing']::text[]
    when 'local_business.approved_for_outreach' then array['processing', 'access']::text[]
    when 'local_business.outreach_drafted' then array['processing']::text[]
    when 'local_business.outreach_approved' then array['processing', 'access']::text[]
    when 'local_business.outreach_sent' then array['access', 'processing']::text[]
    when 'local_business.responded' then array['input', 'processing']::text[]
    when 'local_business.converted' then array['processing']::text[]
    when 'local_business.disqualified' then array['rejection', 'processing']::text[]
    when 'local_business.archived' then array['rejection']::text[]

    when 'paperclip.issue.created' then array['input', 'processing']::text[]
    when 'paperclip.issue.assigned' then array['access', 'processing']::text[]
    when 'paperclip.issue.in_progress' then array['processing']::text[]
    when 'paperclip.issue.blocked' then array['rejection', 'processing']::text[]
    when 'paperclip.issue.resolved' then array['processing']::text[]
    when 'paperclip.issue.closed' then array['processing', 'rejection']::text[]

    when 'system.error' then array['environment']::text[]
    when 'system.timeout' then array['environment', 'program_change']::text[]
    when 'system.degraded' then array['environment']::text[]
    when 'system.recovered' then array['environment']::text[]
    when 'system.retry.requested' then array['program_change', 'environment']::text[]
    when 'system.retry.succeeded' then array['environment']::text[]
    when 'system.external_signal.detected' then array['economic']::text[]

    else '{}'::text[]
  end
$function$;

-- =============================================================================
-- 3. Backfill existing local_business.* events with proper risk classification
-- =============================================================================
--
-- Events written before this migration came in with NULL risk_category etc.
-- because the SQL functions didn't recognize local_business.*. Now they do —
-- so we can backfill.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'events'
      and column_name = 'canonical_event_type'
  ) then
    update public.events
    set
      risk_category = public.event_risk_category(coalesce(canonical_event_type, event_type)),
      risk_assertions = public.event_risk_assertions(coalesce(canonical_event_type, event_type)),
      risk_version = 'risk-map-v1'
    where event_type like 'local_business.%'
      and source_system = 'local_business_pipeline'
      and risk_category is null;
  else
    update public.events
    set
      risk_category = public.event_risk_category(event_type),
      risk_assertions = public.event_risk_assertions(event_type),
      risk_version = 'risk-map-v1'
    where event_type like 'local_business.%'
      and source_system = 'local_business_pipeline'
      and risk_category is null;
  end if;
end $$;

commit;
