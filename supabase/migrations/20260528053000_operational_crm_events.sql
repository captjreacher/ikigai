-- Issue #27: deterministic operational CRM events.
-- Emits lead.* and tag.* events from CRM spine table operations into public.events.

begin;

create index if not exists events_operational_crm_timeline_idx
  on public.events ((payload->>'lead_id'), created_at desc)
  where source_system = 'operational_crm';

create or replace function public.crm_actor_from_metadata(
  p_metadata jsonb,
  p_source text default null,
  p_user_id uuid default null
) returns jsonb
language sql
stable
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'type',
      coalesce(
        nullif(p_metadata->>'actor_type', ''),
        case
          when p_user_id is not null then 'human'
          when p_source in ('system', 'enrichment') then 'system'
          else 'human'
        end
      ),
    'id', coalesce(nullif(p_metadata->>'actor_id', ''), p_user_id::text),
    'label', nullif(p_metadata->>'actor_label', '')
  ));
$$;

comment on function public.crm_actor_from_metadata(jsonb, text, uuid) is
  'Builds the deterministic actor payload for CRM events. Supports human UUID actors and system actors supplied via metadata.';

create or replace function public.emit_operational_crm_event(
  p_event_type text,
  p_lead_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_status text,
  p_payload jsonb default '{}'::jsonb,
  p_correlation_id text default null,
  p_source_system text default null,
  p_actor jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event_id uuid;
  v_source_system text := coalesce(nullif(p_source_system, ''), 'operational_crm');
  v_actor jsonb := coalesce(p_actor, '{}'::jsonb);
  v_payload jsonb;
begin
  v_payload := jsonb_strip_nulls(
    jsonb_build_object(
      'schema_version', 'operational-crm-event-v1',
      'lead_id', p_lead_id::text,
      'entity_type', p_entity_type,
      'entity_id', p_entity_id::text,
      'actor', v_actor,
      'source_system', v_source_system,
      'correlation_id', nullif(p_correlation_id, '')
    )
  ) || coalesce(p_payload, '{}'::jsonb);

  insert into public.events (
    source_system,
    event_type,
    entity_type,
    entity_id,
    entity_ref,
    status,
    payload,
    correlation_id,
    metadata,
    risk_category,
    risk_assertions,
    risk_version
  ) values (
    v_source_system,
    p_event_type,
    p_entity_type,
    p_entity_id::text,
    p_entity_type || ':' || p_entity_id::text,
    p_status,
    v_payload,
    nullif(p_correlation_id, ''),
    jsonb_strip_nulls(jsonb_build_object(
      'lead_id', p_lead_id::text,
      'correlation_id', nullif(p_correlation_id, ''),
      'source_system', v_source_system,
      'actor', v_actor
    )),
    'business_process',
    case p_event_type
      when 'lead.contact_added' then array['input', 'processing']::text[]
      when 'lead.activity_logged' then array['input', 'processing']::text[]
      when 'lead.task_created' then array['processing']::text[]
      when 'lead.task_completed' then array['processing']::text[]
      when 'lead.outreach_started' then array['access', 'processing']::text[]
      when 'lead.status_changed' then array['processing']::text[]
      when 'tag.applied' then array['processing']::text[]
      when 'tag.removed' then array['processing']::text[]
      else array['processing']::text[]
    end,
    'risk-map-v1'
  )
  returning id into v_event_id;

  return v_event_id;
end;
$$;

comment on function public.emit_operational_crm_event(text, uuid, text, uuid, text, jsonb, text, text, jsonb) is
  'Writes deterministic operational CRM events into public.events with text entity_id, correlation_id, source_system, actor, and stable payload envelope.';

create or replace function public.lead_contacts_after_insert_emit_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.emit_operational_crm_event(
    'lead.contact_added',
    new.lead_id,
    'lead_contact',
    new.id,
    'created',
    jsonb_strip_nulls(jsonb_build_object(
      'contact_id', new.id::text,
      'full_name', new.full_name,
      'role_title', new.role_title,
      'email', new.email,
      'phone', new.phone,
      'decision_maker', new.decision_maker,
      'primary_contact', new.primary_contact
    )),
    nullif(new.metadata->>'correlation_id', ''),
    coalesce(nullif(new.metadata->>'source_system', ''), 'operational_crm'),
    public.crm_actor_from_metadata(new.metadata, null, null)
  );
  return new;
end;
$$;

drop trigger if exists trg_lead_contacts_after_insert_emit_event on public.lead_contacts;
create trigger trg_lead_contacts_after_insert_emit_event
after insert on public.lead_contacts
for each row execute function public.lead_contacts_after_insert_emit_event();

create or replace function public.lead_activities_after_insert_emit_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_activity_type text;
begin
  select slug into v_activity_type
  from public.activity_types
  where id = new.activity_type_id;

  perform public.emit_operational_crm_event(
    'lead.activity_logged',
    new.lead_id,
    'lead_activity',
    new.id,
    'logged',
    jsonb_strip_nulls(jsonb_build_object(
      'activity_id', new.id::text,
      'activity_type_id', new.activity_type_id::text,
      'activity_type', v_activity_type,
      'contact_id', new.contact_id::text,
      'title', new.title,
      'description', new.description,
      'occurred_at', new.occurred_at,
      'source', new.source
    )),
    nullif(new.metadata->>'correlation_id', ''),
    coalesce(nullif(new.metadata->>'source_system', ''), 'operational_crm'),
    public.crm_actor_from_metadata(new.metadata, new.source, new.created_by)
  );
  return new;
end;
$$;

drop trigger if exists trg_lead_activities_after_insert_emit_event on public.lead_activities;
create trigger trg_lead_activities_after_insert_emit_event
after insert on public.lead_activities
for each row execute function public.lead_activities_after_insert_emit_event();

create or replace function public.lead_tasks_after_insert_emit_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.emit_operational_crm_event(
    'lead.task_created',
    new.lead_id,
    'lead_task',
    new.id,
    new.status,
    jsonb_strip_nulls(jsonb_build_object(
      'task_id', new.id::text,
      'contact_id', new.contact_id::text,
      'title', new.title,
      'description', new.description,
      'status', new.status,
      'priority', new.priority,
      'due_at', new.due_at,
      'assigned_to', new.assigned_to::text
    )),
    nullif(new.metadata->>'correlation_id', ''),
    coalesce(nullif(new.metadata->>'source_system', ''), 'operational_crm'),
    public.crm_actor_from_metadata(new.metadata, null, null)
  );
  return new;
end;
$$;

drop trigger if exists trg_lead_tasks_after_insert_emit_event on public.lead_tasks;
create trigger trg_lead_tasks_after_insert_emit_event
after insert on public.lead_tasks
for each row execute function public.lead_tasks_after_insert_emit_event();

create or replace function public.lead_tasks_after_completed_emit_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'completed' and old.status is distinct from new.status then
    perform public.emit_operational_crm_event(
      'lead.task_completed',
      new.lead_id,
      'lead_task',
      new.id,
      new.status,
      jsonb_strip_nulls(jsonb_build_object(
        'task_id', new.id::text,
        'contact_id', new.contact_id::text,
        'title', new.title,
        'prior_status', old.status,
        'status', new.status,
        'completed_at', new.completed_at
      )),
      nullif(new.metadata->>'correlation_id', ''),
      coalesce(nullif(new.metadata->>'source_system', ''), 'operational_crm'),
      public.crm_actor_from_metadata(new.metadata, null, null)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_lead_tasks_after_completed_emit_event on public.lead_tasks;
create trigger trg_lead_tasks_after_completed_emit_event
after update of status on public.lead_tasks
for each row execute function public.lead_tasks_after_completed_emit_event();

create or replace function public.lead_outreach_after_insert_emit_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.emit_operational_crm_event(
    'lead.outreach_started',
    new.lead_id,
    'lead_outreach',
    new.id,
    new.status,
    jsonb_strip_nulls(jsonb_build_object(
      'outreach_id', new.id::text,
      'contact_id', new.contact_id::text,
      'channel', new.channel,
      'direction', new.direction,
      'subject', new.subject,
      'status', new.status,
      'external_message_id', new.external_message_id,
      'sent_at', new.sent_at
    )),
    nullif(new.metadata->>'correlation_id', ''),
    coalesce(nullif(new.metadata->>'source_system', ''), 'operational_crm'),
    public.crm_actor_from_metadata(new.metadata, null, null)
  );
  return new;
end;
$$;

drop trigger if exists trg_lead_outreach_after_insert_emit_event on public.lead_outreach;
create trigger trg_lead_outreach_after_insert_emit_event
after insert on public.lead_outreach
for each row execute function public.lead_outreach_after_insert_emit_event();

create or replace function public.local_business_leads_after_status_changed_emit_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status is distinct from old.status then
    perform public.emit_operational_crm_event(
      'lead.status_changed',
      new.id,
      'lead',
      new.id,
      new.status,
      jsonb_strip_nulls(jsonb_build_object(
        'business_name', new.business_name,
        'slug', new.slug,
        'lead_source', new.source,
        'prior_status', old.status,
        'status', new.status
      )),
      null,
      'operational_crm',
      jsonb_build_object('type', 'system', 'label', 'local_business_leads.status trigger')
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_local_business_leads_after_status_changed_emit_event on public.local_business_leads;
create trigger trg_local_business_leads_after_status_changed_emit_event
after update of status on public.local_business_leads
for each row execute function public.local_business_leads_after_status_changed_emit_event();

create or replace function public.entity_tags_emit_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.entity_tags%rowtype;
  v_tag_slug text;
  v_tag_label text;
  v_lead_id uuid;
  v_event_type text;
  v_status text;
begin
  if tg_op = 'DELETE' then
    v_row := old;
    v_event_type := 'tag.removed';
    v_status := 'removed';
  else
    v_row := new;
    v_event_type := 'tag.applied';
    v_status := 'applied';
  end if;

  select slug, label into v_tag_slug, v_tag_label
  from public.tags
  where id = v_row.tag_id;

  case v_row.entity_type
    when 'lead' then
      v_lead_id := v_row.entity_id;
    when 'contact' then
      select lead_id into v_lead_id from public.lead_contacts where id = v_row.entity_id;
    when 'task' then
      select lead_id into v_lead_id from public.lead_tasks where id = v_row.entity_id;
    when 'outreach' then
      select lead_id into v_lead_id from public.lead_outreach where id = v_row.entity_id;
    when 'activity' then
      select lead_id into v_lead_id from public.lead_activities where id = v_row.entity_id;
  end case;

  perform public.emit_operational_crm_event(
    v_event_type,
    v_lead_id,
    'entity_tag',
    v_row.id,
    v_status,
    jsonb_strip_nulls(jsonb_build_object(
      'entity_tag_id', v_row.id::text,
      'tag_id', v_row.tag_id::text,
      'tag_slug', v_tag_slug,
      'tag_label', v_tag_label,
      'tagged_entity_type', v_row.entity_type,
      'tagged_entity_id', v_row.entity_id::text,
      'source', v_row.source,
      'confidence', v_row.confidence
    )),
    null,
    'operational_crm',
    public.crm_actor_from_metadata('{}'::jsonb, v_row.source, v_row.created_by)
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_entity_tags_after_insert_emit_event on public.entity_tags;
create trigger trg_entity_tags_after_insert_emit_event
after insert on public.entity_tags
for each row execute function public.entity_tags_emit_event();

drop trigger if exists trg_entity_tags_before_delete_emit_event on public.entity_tags;
create trigger trg_entity_tags_before_delete_emit_event
before delete on public.entity_tags
for each row execute function public.entity_tags_emit_event();

create or replace view public.operational_crm_lead_timeline_view
with (security_invoker = true)
as
select
  e.id as event_id,
  (e.payload->>'lead_id')::uuid as lead_id,
  e.event_type,
  e.entity_type,
  e.entity_id,
  e.status,
  e.source_system,
  e.correlation_id,
  e.payload->'actor' as actor,
  e.payload,
  e.created_at
from public.events e
where e.source_system = 'operational_crm'
  and e.event_type in (
    'lead.contact_added',
    'lead.activity_logged',
    'lead.task_created',
    'lead.task_completed',
    'lead.outreach_started',
    'lead.status_changed',
    'tag.applied',
    'tag.removed'
  );

grant select on public.operational_crm_lead_timeline_view to authenticated;

comment on view public.operational_crm_lead_timeline_view is
  'Cockpit-facing verification/read model for deterministic CRM lead timeline events emitted by issue #27 triggers.';

commit;
