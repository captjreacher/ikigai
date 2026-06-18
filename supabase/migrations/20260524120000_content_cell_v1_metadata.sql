-- Content Cell v1 workflow metadata.
-- Supabase remains the source-of-truth state machine; Cockpit and Paperclip
-- consume these fields for controlled routing and approval.

begin;

alter table public.content_packages
  add column if not exists cell_key text default 'content',
  add column if not exists workflow_key text default 'content_loop_v1',
  add column if not exists workflow_stage text default 'idea_captured',
  add column if not exists assigned_role text,
  add column if not exists assigned_agent text,
  add column if not exists brand text default 'MGRNZ';

alter table public.content_outputs
  add column if not exists workflow_stage text,
  add column if not exists assigned_role text,
  add column if not exists revision_count integer default 0,
  add column if not exists returned_by_role text;

alter table public.content_packages
  alter column cell_key set default 'content',
  alter column workflow_key set default 'content_loop_v1',
  alter column workflow_stage set default 'idea_captured',
  alter column brand set default 'MGRNZ';

alter table public.content_outputs
  alter column revision_count set default 0;

update public.content_packages
set
  cell_key = coalesce(cell_key, 'content'),
  workflow_key = coalesce(workflow_key, 'content_loop_v1'),
  workflow_stage = coalesce(workflow_stage, 'idea_captured'),
  brand = coalesce(brand, 'MGRNZ')
where cell_key is null
   or workflow_key is null
   or workflow_stage is null
   or brand is null;

update public.content_outputs
set revision_count = coalesce(revision_count, 0)
where revision_count is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'content_packages_content_cell_key_check'
      and conrelid = 'public.content_packages'::regclass
  ) then
    alter table public.content_packages
      add constraint content_packages_content_cell_key_check
      check (cell_key = 'content') not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'content_packages_content_workflow_key_check'
      and conrelid = 'public.content_packages'::regclass
  ) then
    alter table public.content_packages
      add constraint content_packages_content_workflow_key_check
      check (workflow_key = 'content_loop_v1') not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'content_packages_content_workflow_stage_check'
      and conrelid = 'public.content_packages'::regclass
  ) then
    alter table public.content_packages
      add constraint content_packages_content_workflow_stage_check
      check (
        workflow_stage in (
          'idea_captured',
          'brief_required',
          'brief_ready',
          'writer_draft_required',
          'writer_draft_ready',
          'design_required',
          'design_ready',
          'editor_review_required',
          'editor_review_ready',
          'ceo_review_required',
          'approved',
          'published',
          'rejected',
          'revision_requested',
          'needs_paperclip',
          'archived'
        )
      ) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'content_packages_content_assigned_role_check'
      and conrelid = 'public.content_packages'::regclass
  ) then
    alter table public.content_packages
      add constraint content_packages_content_assigned_role_check
      check (
        assigned_role is null or assigned_role in (
          'content_editor_ba',
          'content_writer',
          'content_designer',
          'content_final_editor',
          'ceo_approver'
        )
      ) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'content_outputs_content_workflow_stage_check'
      and conrelid = 'public.content_outputs'::regclass
  ) then
    alter table public.content_outputs
      add constraint content_outputs_content_workflow_stage_check
      check (
        workflow_stage is null or workflow_stage in (
          'idea_captured',
          'brief_required',
          'brief_ready',
          'writer_draft_required',
          'writer_draft_ready',
          'design_required',
          'design_ready',
          'editor_review_required',
          'editor_review_ready',
          'ceo_review_required',
          'approved',
          'published',
          'rejected',
          'revision_requested',
          'needs_paperclip',
          'archived'
        )
      ) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'content_outputs_content_assigned_role_check'
      and conrelid = 'public.content_outputs'::regclass
  ) then
    alter table public.content_outputs
      add constraint content_outputs_content_assigned_role_check
      check (
        assigned_role is null or assigned_role in (
          'content_editor_ba',
          'content_writer',
          'content_designer',
          'content_final_editor',
          'ceo_approver'
        )
      ) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'content_outputs_content_returned_by_role_check'
      and conrelid = 'public.content_outputs'::regclass
  ) then
    alter table public.content_outputs
      add constraint content_outputs_content_returned_by_role_check
      check (
        returned_by_role is null or returned_by_role in (
          'content_editor_ba',
          'content_writer',
          'content_designer',
          'content_final_editor',
          'ceo_approver'
        )
      ) not valid;
  end if;
end $$;

create index if not exists content_packages_content_cell_workflow_idx
  on public.content_packages (cell_key, workflow_key, workflow_stage);

create index if not exists content_packages_content_assigned_role_idx
  on public.content_packages (assigned_role)
  where assigned_role is not null;

create index if not exists content_outputs_content_workflow_stage_idx
  on public.content_outputs (workflow_stage)
  where workflow_stage is not null;

create index if not exists content_outputs_content_assigned_role_idx
  on public.content_outputs (assigned_role)
  where assigned_role is not null;

comment on column public.content_packages.cell_key is
  'Content Cell routing boundary. Phase 1 supports content only.';

comment on column public.content_packages.workflow_key is
  'Content Cell workflow identifier. Phase 1 uses content_loop_v1.';

comment on column public.content_packages.workflow_stage is
  'Current Content Cell package stage for Cockpit routing and approval.';

comment on column public.content_outputs.workflow_stage is
  'Current Content Cell output stage for review, revision, and Paperclip routing.';

comment on column public.content_outputs.revision_count is
  'Number of revision requests made through controlled review actions.';

commit;
