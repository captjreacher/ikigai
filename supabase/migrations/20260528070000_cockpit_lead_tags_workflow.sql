-- Issue #29: Cockpit lead tag workflow support.
-- Adds a lead-facing tag read model and protects deterministic tag applications
-- from unsafe manual deletion while preserving manual tag removal.

begin;

create or replace view public.cockpit_lead_tags_view
with (security_invoker = true)
as
select
  et.id as entity_tag_id,
  et.entity_id as lead_id,
  et.source,
  et.confidence,
  et.created_by,
  et.created_at,
  t.id as tag_id,
  t.slug as tag_slug,
  coalesce(t.category, split_part(t.slug, '/', 1)) as tag_category,
  t.label as tag_label,
  t.description as tag_description,
  t.color as tag_color,
  t.system_managed
from public.entity_tags et
join public.tags t on t.id = et.tag_id
where et.entity_type = 'lead';

comment on view public.cockpit_lead_tags_view is
  'Cockpit-facing lead tag projection. Tag slugs use namespace/name format such as trust/no_website.';

create or replace function public.protect_system_managed_tags()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' and old.system_managed then
    raise exception 'Cannot delete system-managed tag %', old.slug
      using errcode = 'insufficient_privilege';
  end if;

  if tg_op = 'UPDATE' and old.system_managed and (
    new.system_managed is distinct from true
    or new.slug is distinct from old.slug
    or new.category is distinct from old.category
  ) then
    raise exception 'Cannot alter protected system-managed tag identity %', old.slug
      using errcode = 'insufficient_privilege';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

comment on function public.protect_system_managed_tags() is
  'Protects deterministic tag definitions from deletion or identity changes through authenticated writes.';

drop trigger if exists trg_tags_protect_system_managed on public.tags;
create trigger trg_tags_protect_system_managed
before update or delete on public.tags
for each row execute function public.protect_system_managed_tags();

create or replace function public.prevent_unsafe_entity_tag_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_system_managed boolean;
begin
  select system_managed
  into v_system_managed
  from public.tags
  where id = old.tag_id;

  if coalesce(v_system_managed, false) and old.source <> 'manual' then
    raise exception 'Cannot manually remove system-managed tag application %', old.id
      using errcode = 'insufficient_privilege';
  end if;

  return old;
end;
$$;

comment on function public.prevent_unsafe_entity_tag_delete() is
  'Prevents deletion of deterministic/system-managed tag applications unless the association was manually created.';

drop trigger if exists trg_entity_tags_prevent_unsafe_delete on public.entity_tags;
create trigger trg_entity_tags_prevent_unsafe_delete
before delete on public.entity_tags
for each row execute function public.prevent_unsafe_entity_tag_delete();

commit;
