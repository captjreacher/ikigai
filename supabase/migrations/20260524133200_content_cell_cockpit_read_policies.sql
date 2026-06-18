-- Cockpit Content Cell v1 visibility.
-- Read-only policies let the Cockpit anon/authenticated client render the
-- controlled workflow. Mutating review actions still go through Edge Functions
-- with an authenticated user JWT.

begin;

alter table public.content_packages enable row level security;
alter table public.content_outputs enable row level security;

grant select on public.content_packages to anon, authenticated;
grant select on public.content_outputs to anon, authenticated;

drop policy if exists "cockpit read content packages" on public.content_packages;
create policy "cockpit read content packages"
  on public.content_packages for select
  to anon, authenticated
  using (cell_key = 'content');

drop policy if exists "cockpit read content outputs" on public.content_outputs;
create policy "cockpit read content outputs"
  on public.content_outputs for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.content_packages p
      where p.id = content_outputs.package_id
        and p.cell_key = 'content'
    )
  );

commit;
