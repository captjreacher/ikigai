-- Own contact layer projection.
-- public.events remains the immutable event store; public.contacts is extended
-- from the older intake-style table into a lightweight current-state projection.

begin;

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid()
);

alter table public.contacts
  add column if not exists full_name text,
  add column if not exists business_name text,
  add column if not exists email text,
  add column if not exists enquiry_type text,
  add column if not exists message text,
  add column if not exists status text,
  add column if not exists phone text,
  add column if not exists source_system text,
  add column if not exists relationship_types text[] not null default array['lead'],
  add column if not exists lifecycle_stage text not null default 'new',
  add column if not exists lead_status text not null default 'new',
  add column if not exists owner text,
  add column if not exists tags text[] not null default '{}',
  add column if not exists notes text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists first_seen_at timestamptz not null default now(),
  add column if not exists last_seen_at timestamptz not null default now(),
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.contacts
set email = null
where email is not null
  and btrim(email) = '';

update public.contacts
set email = lower(btrim(email))
where email is not null
  and email <> lower(btrim(email));

with ranked_contacts as (
  select
    ctid,
    email,
    row_number() over (
      partition by lower(email)
      order by created_at nulls last, ctid
    ) as email_rank
  from public.contacts
  where email is not null
)
update public.contacts as c
set
  metadata = c.metadata || jsonb_build_object(
    'projection_duplicate_email', ranked_contacts.email,
    'projection_duplicate_email_cleaned_at', now()
  ),
  email = null
from ranked_contacts
where c.ctid = ranked_contacts.ctid
  and ranked_contacts.email_rank > 1;

create unique index if not exists contacts_email_lower_unique_idx
  on public.contacts (lower(email))
  where email is not null;

alter table public.contacts enable row level security;

create index if not exists contacts_last_seen_at_idx
  on public.contacts (last_seen_at desc);

create index if not exists contacts_relationship_types_gin_idx
  on public.contacts using gin (relationship_types);

create index if not exists contacts_tags_gin_idx
  on public.contacts using gin (tags);

create or replace function public.set_contacts_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_contacts_updated_at on public.contacts;

create trigger trg_contacts_updated_at
  before update on public.contacts
  for each row
  execute function public.set_contacts_updated_at();

create or replace function public.project_lead_captured_contact()
returns trigger as $$
declare
  contact_id uuid;
  contact_created boolean := false;
  contact_email text;
  contact_full_name text;
  contact_phone text;
  contact_business_name text;
  contact_message text;
  contact_source_system text;
  contact_tags text[] := '{}';
  contact_metadata jsonb;
  event_seen_at timestamptz;
  lead_payload jsonb;
begin
  if new.event_type <> 'lead.captured' then
    return new;
  end if;

  lead_payload := coalesce(
    case
      when jsonb_typeof(new.payload->'payload') = 'object' then new.payload->'payload'
      else null
    end,
    new.payload,
    '{}'::jsonb
  );

  contact_email := lower(nullif(btrim(lead_payload->>'email'), ''));

  if contact_email is null then
    raise exception 'lead.captured payload.email is required'
      using errcode = '23514';
  end if;

  contact_full_name := nullif(btrim(lead_payload->>'name'), '');
  contact_phone := nullif(btrim(lead_payload->>'phone'), '');
  contact_business_name := coalesce(
    nullif(btrim(lead_payload->>'business_name'), ''),
    nullif(btrim(lead_payload->>'organisation'), ''),
    nullif(btrim(lead_payload->>'organization'), '')
  );
  contact_message := nullif(btrim(lead_payload->>'message'), '');
  contact_source_system := coalesce(
    nullif(btrim(new.source_system), ''),
    nullif(btrim(lead_payload->>'source_system'), ''),
    nullif(btrim(lead_payload->>'source'), '')
  );
  event_seen_at := coalesce(new.created_at, now());

  if jsonb_typeof(lead_payload->'tags') = 'array' then
    select coalesce(array_agg(distinct tag_value), '{}')
    into contact_tags
    from jsonb_array_elements_text(lead_payload->'tags') as tag(tag_value)
    where btrim(tag_value) <> '';
  end if;

  contact_metadata := jsonb_strip_nulls(jsonb_build_object(
    'last_lead_event_id', new.id,
    'last_lead_entity_id', new.entity_id,
    'last_lead_entity_ref', new.entity_ref,
    'last_lead_payload', lead_payload,
    'last_lead_captured_at', event_seen_at
  ));

  select id
  into contact_id
  from public.contacts
  where email is not null
    and lower(email) = contact_email
  order by created_at nulls last, id
  limit 1;

  if contact_id is null then
    insert into public.contacts (
      email,
      full_name,
      phone,
      business_name,
      message,
      status,
      source_system,
      tags,
      metadata,
      first_seen_at,
      last_seen_at
    )
    values (
      contact_email,
      contact_full_name,
      contact_phone,
      contact_business_name,
      contact_message,
      'new',
      contact_source_system,
      contact_tags,
      contact_metadata,
      event_seen_at,
      event_seen_at
    )
    returning id into contact_id;

    contact_created := true;
  else
    update public.contacts
    set
      email = contact_email,
      full_name = coalesce(contact_full_name, public.contacts.full_name),
      phone = coalesce(contact_phone, public.contacts.phone),
      business_name = coalesce(contact_business_name, public.contacts.business_name),
      message = coalesce(contact_message, public.contacts.message),
      status = coalesce(public.contacts.status, 'new'),
      source_system = coalesce(contact_source_system, public.contacts.source_system),
      relationship_types = case
        when 'lead' = any(public.contacts.relationship_types) then public.contacts.relationship_types
        else public.contacts.relationship_types || array['lead']
      end,
      tags = (
        select coalesce(array_agg(distinct merged_tag order by merged_tag), '{}')
        from unnest(public.contacts.tags || contact_tags) as merged(merged_tag)
        where btrim(merged_tag) <> ''
      ),
      metadata = public.contacts.metadata || contact_metadata,
      last_seen_at = greatest(public.contacts.last_seen_at, event_seen_at)
    where public.contacts.id = contact_id
    returning id into contact_id;
  end if;

  insert into public.events (
    source_system,
    event_type,
    entity_type,
    entity_id,
    entity_ref,
    status,
    payload
  )
  values (
    'contact_projection',
    case when contact_created then 'contact.created' else 'contact.updated' end,
    'contact',
    contact_id,
    contact_email,
    case when contact_created then 'created' else 'updated' end,
    jsonb_build_object(
      'contact_id', contact_id,
      'email', contact_email,
      'lead_event_id', new.id,
      'lead_event_created_at', event_seen_at,
      'projection', 'contacts'
    )
  );

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_project_lead_captured_contact on public.events;

create trigger trg_project_lead_captured_contact
  after insert on public.events
  for each row
  when (new.event_type = 'lead.captured')
  execute function public.project_lead_captured_contact();

create or replace function public.update_contact_lead_status(
  contact_id uuid,
  lead_status text
)
returns public.contacts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated_contact public.contacts%rowtype;
begin
  if lead_status not in (
    'new',
    'contacted',
    'responded',
    'booked_call',
    'no_response',
    'disqualified',
    'converted',
    'nurture'
  ) then
    raise exception 'Invalid lead_status: %', lead_status
      using errcode = '22023';
  end if;

  update public.contacts as c
  set lead_status = update_contact_lead_status.lead_status
  where c.id = update_contact_lead_status.contact_id
  returning c.* into updated_contact;

  if updated_contact.id is null then
    raise exception 'Contact not found: %', contact_id
      using errcode = '02000';
  end if;

  return updated_contact;
end;
$$;

revoke insert, update, delete on public.contacts from anon, authenticated;
revoke execute on function public.update_contact_lead_status(uuid, text) from public;

grant select on public.contacts to anon, authenticated;
grant execute on function public.update_contact_lead_status(uuid, text) to anon, authenticated;

drop policy if exists "Cockpit can read contacts" on public.contacts;
create policy "Cockpit can read contacts"
  on public.contacts
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Cockpit can create contacts" on public.contacts;
drop policy if exists "Cockpit can manage contacts" on public.contacts;

comment on table public.contacts is
  'Current-state contact projection extended from the older intake contacts table and derived from immutable public.events lead.captured events.';

comment on function public.project_lead_captured_contact() is
  'Maintains public.contacts and emits contact.created/contact.updated when lead.captured events are inserted.';

comment on function public.update_contact_lead_status(uuid, text) is
  'Narrow Cockpit RPC for changing only contacts.lead_status.';

commit;
