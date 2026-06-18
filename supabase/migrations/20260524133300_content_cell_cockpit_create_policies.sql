-- Cockpit Content Cell v1 package creation.
-- Authenticated operators may create content-cell packages, requested output
-- placeholders, and the corresponding package-created event. Review and
-- publishing actions still remain behind their existing Edge Functions.

begin;

alter table public.content_packages enable row level security;
alter table public.content_outputs enable row level security;
alter table public.events enable row level security;

grant insert on public.content_packages to authenticated;
grant insert on public.content_outputs to authenticated;
grant insert on public.events to authenticated;

drop policy if exists "cockpit create content packages" on public.content_packages;
create policy "cockpit create content packages"
  on public.content_packages for insert
  to authenticated
  with check (
    cell_key = 'content'
    and workflow_key = 'content_loop_v1'
    and brand in ('MGRNZ', 'mgrnz')
    and workflow_stage = 'brief_required'
    and assigned_role = 'content_editor_ba'
  );

drop policy if exists "cockpit create content outputs" on public.content_outputs;
create policy "cockpit create content outputs"
  on public.content_outputs for insert
  to authenticated
  with check (
    status = 'draft_requested'
    and workflow_stage = 'writer_draft_required'
    and assigned_role = 'content_writer'
    and exists (
      select 1
      from public.content_packages p
      where p.id = content_outputs.package_id
        and p.cell_key = 'content'
        and p.workflow_key = 'content_loop_v1'
    )
  );

drop policy if exists "cockpit create content package events" on public.events;
create policy "cockpit create content package events"
  on public.events for insert
  to authenticated
  with check (
    source_system = 'cockpit'
    and event_type = 'content.package.created'
    and entity_type = 'content_package'
  );

commit;
