-- Issue #26 follow-up: complete operational CRM spine contract.
-- Keeps the original schema additive while tightening timestamp and entity-tag guarantees.

begin;

alter table public.lead_activities
  add column if not exists updated_at timestamptz not null default now();

alter table public.lead_outreach
  add column if not exists updated_at timestamptz not null default now();

alter table public.entity_tags
  add column if not exists updated_at timestamptz not null default now();

alter table public.entity_tags
  add column if not exists entity_ref text
  generated always as (entity_type || ':' || entity_id::text) stored;

create unique index if not exists entity_tags_entity_ref_tag_id_idx
  on public.entity_tags(entity_ref, tag_id);

drop trigger if exists trg_lead_activities_updated_at on public.lead_activities;
create trigger trg_lead_activities_updated_at
before update on public.lead_activities
for each row execute function public.set_updated_at();

drop trigger if exists trg_lead_outreach_updated_at on public.lead_outreach;
create trigger trg_lead_outreach_updated_at
before update on public.lead_outreach
for each row execute function public.set_updated_at();

drop trigger if exists trg_entity_tags_updated_at on public.entity_tags;
create trigger trg_entity_tags_updated_at
before update on public.entity_tags
for each row execute function public.set_updated_at();

create or replace function public.validate_entity_tag_target()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_exists boolean;
begin
  case new.entity_type
    when 'lead' then
      select exists(select 1 from public.local_business_leads where id = new.entity_id)
        into v_exists;
    when 'contact' then
      select exists(select 1 from public.lead_contacts where id = new.entity_id)
        into v_exists;
    when 'task' then
      select exists(select 1 from public.lead_tasks where id = new.entity_id)
        into v_exists;
    when 'outreach' then
      select exists(select 1 from public.lead_outreach where id = new.entity_id)
        into v_exists;
    when 'activity' then
      select exists(select 1 from public.lead_activities where id = new.entity_id)
        into v_exists;
    else
      v_exists := false;
  end case;

  if not v_exists then
    raise exception 'entity_tags target %.% does not exist', new.entity_type, new.entity_id
      using errcode = 'foreign_key_violation';
  end if;

  return new;
end;
$$;

comment on function public.validate_entity_tag_target() is
  'Validates polymorphic entity_tags references against the CRM spine tables before insert/update.';

drop trigger if exists trg_entity_tags_validate_target on public.entity_tags;
create trigger trg_entity_tags_validate_target
before insert or update of entity_type, entity_id on public.entity_tags
for each row execute function public.validate_entity_tag_target();

commit;
