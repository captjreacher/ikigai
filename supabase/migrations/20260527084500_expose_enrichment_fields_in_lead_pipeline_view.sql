drop view if exists public.local_business_lead_pipeline_view;

create or replace view public.local_business_lead_pipeline_view as
select
  l.id as lead_id,
  l.business_name,
  coalesce(to_jsonb(l)->>'source', null) as source,
  coalesce(to_jsonb(l)->>'platform', to_jsonb(l)->>'source_platform') as platform,
  coalesce(to_jsonb(l)->>'campaign_name', null) as campaign_name,
  coalesce(to_jsonb(l)->>'leadgen_id', null) as leadgen_id,
  l.category,
  l.suburb,
  coalesce(to_jsonb(l)->>'region', null) as region,
  coalesce(to_jsonb(l)->>'country', null) as country,
  l.status,
  coalesce(to_jsonb(l)->>'enrichment_status', 'not_started') as enrichment_status,
  coalesce(to_jsonb(l)->'enrichment_confidence', '{}'::jsonb) as enrichment_confidence,
  coalesce(to_jsonb(l)->'enrichment_diagnostics', '{}'::jsonb) as enrichment_diagnostics,
  nullif(to_jsonb(l)->>'enriched_at', '')::timestamptz as enriched_at,
  coalesce(to_jsonb(l)->>'address', null) as address,
  l.phone,
  l.email,
  l.website_url,
  l.facebook_url,
  l.google_maps_url,
  coalesce(to_jsonb(l)->'social_links', '[]'::jsonb) as social_links,
  coalesce(to_jsonb(l)->'service_areas', '[]'::jsonb) as service_areas,
  coalesce(to_jsonb(l)->'categories', '[]'::jsonb) as categories,
  coalesce(to_jsonb(l)->'review_signals', '[]'::jsonb) as review_signals,
  coalesce(to_jsonb(l)->'trust_signals', '[]'::jsonb) as trust_signals,
  coalesce(to_jsonb(l)->'risk_flags', '[]'::jsonb) as risk_flags,
  coalesce(to_jsonb(l)->'source_urls', '[]'::jsonb) as source_urls,
  nullif(to_jsonb(l)->>'confidence_score', '')::numeric as confidence_score,
  nullif(to_jsonb(l)->>'trust_score', '')::numeric as trust_score,
  l.trust_signal_score,
  l.trust_summary,
  l.trust_flags,
  coalesce(to_jsonb(l)->>'data_alignment_status', null) as data_alignment_status,
  a.demand_signal_score,
  a.trust_leakage_score,
  a.conversion_maturity_score,
  a.ai_readiness_score,
  a.opportunity_score,
  a.recommended_outreach_angle,
  a.assessment_summary,
  coalesce(to_jsonb(a)->>'assessed_at', to_jsonb(a)->>'created_at', to_jsonb(a)->>'updated_at')::timestamptz as latest_assessment_at,
  e.event_type as latest_event_type,
  e.created_at as latest_event_at
from public.local_business_leads l
left join public.local_business_lead_assessments a on a.lead_id = l.id
left join lateral (
  select event_type, created_at
  from public.events
  where entity_id::text = l.id::text
     or payload->>'lead_id' = l.id::text
  order by created_at desc
  limit 1
) e on true;
