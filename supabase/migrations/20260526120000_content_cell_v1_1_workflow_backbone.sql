
-- Content Cell v1.1 — workflow backbone.
-- Additive layer over Content Cell v1 (20260524120000 .. 20260524133300).
-- Promotes editorial review state to a first-class column, adds output lineage,
-- and exposes a Cockpit-facing queue view with a derived bucket column.
--
-- This version is hardened for schema drift across iterative local/business
-- enrichment and Content Cell development.

begin;

-- =============================================================================
-- 0. Schema reconciliation guards
-- =============================================================================

alter table public.content_outputs
  add column if not exists updated_at timestamptz default now();

-- workflow_stage existed in earlier Content Cell drafts but may not exist in
-- canonical environments anymore. Create it defensively so downstream logic
-- and Cockpit read models remain stable.
alter table public.content_outputs
  add column if not exists workflow_stage text;

-- =============================================================================
-- 1. New columns on public.content_outputs
-- =============================================================================

alter table public.content_outputs
  add column if not exists parent_output_id uuid
    references public.content_outputs(id) on delete set null,
  add column if not exists generation_reason text,
  add column if not exists review_state text not null default 'draft_generated';

comment on column public.content_outputs.parent_output_id is
  'Content Cell v1.1 lineage. Set on regenerated child rows; NULL on originals.';

comment on column public.content_outputs.generation_reason is
  'Content Cell v1.1. Free text tag for why this row was generated. Regenerate path sets ''regeneration''.';

comment on column public.content_outputs.review_state is
  'Content Cell v1.1 editorial overlay. Eight values; defaults to draft_generated.';

-- =============================================================================
-- 2. Check constraint on review_state
-- =============================================================================

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'content_outputs_review_state_check'
      and conrelid = 'public.content_outputs'::regclass
  ) then
    alter table public.content_outputs
      add constraint content_outputs_review_state_check
      check (
        review_state in (
          'draft_generated',
          'strong',
          'needs_rewrite',
          'off_voice',
          'ceo_review',
          'approved',
          'published',
          'archived'
        )
      );
  end if;
end $$;

-- =============================================================================
-- 3. Indexes for parent_output_id, review_state, created_at
-- =============================================================================

create index if not exists content_outputs_parent_output_id_idx
  on public.content_outputs (parent_output_id)
  where parent_output_id is not null;

create index if not exists content_outputs_review_state_idx
  on public.content_outputs (review_state);

create index if not exists content_outputs_created_at_idx
  on public.content_outputs (created_at desc);

-- =============================================================================
-- 4. Backfill review_state from existing v1 signals
-- =============================================================================

-- Published (terminal)
update public.content_outputs
set review_state = 'published'
where review_state = 'draft_generated'
  and status = 'published';

-- Archived (terminal)
update public.content_outputs
set review_state = 'archived'
where review_state = 'draft_generated'
  and status = 'archived';

-- Approved
update public.content_outputs
set review_state = 'approved'
where review_state = 'draft_generated'
  and status = 'approved';

-- CEO review queue
update public.content_outputs
set review_state = 'ceo_review'
where review_state = 'draft_generated'
  and workflow_stage = 'ceo_review_required';

-- Needs rewrite
update public.content_outputs
set review_state = 'needs_rewrite'
where review_state = 'draft_generated'
  and (
    workflow_stage = 'revision_requested'
    or status in ('revision_requested', 'needs_revision')
  );

-- =============================================================================
-- 5. content_review_queue_view
-- =============================================================================

create or replace view public.content_review_queue_view as
select
  o.id                    as id,
  o.package_id            as package_id,
  p.title                 as package_title,
  p.body_markdown         as package_brief,
  p.source_system         as package_source,
  o.output_type           as title,
  o.body                  as body,
  o.status                as status,
  o.review_state          as review_state,
  o.parent_output_id      as parent_output_id,
  o.created_at            as created_at,
  o.updated_at            as updated_at,
  case
    when o.review_state = 'ceo_review'                    then 'ceo_review'
    when o.review_state in ('needs_rewrite', 'off_voice') then 'rewrite'
    when o.review_state = 'strong'                        then 'strong'
    when o.review_state = 'approved'                      then 'approved'
    when o.review_state = 'published'                     then 'published'
    when o.review_state = 'archived'                      then 'archived'
    when o.review_state = 'draft_generated'
         and o.status = 'draft_requested'                 then 'pending_generation'
    when o.review_state = 'draft_generated'               then 'needs_review'
    else                                                       'needs_review'
  end                     as queue_bucket
from public.content_outputs o
left join public.content_packages p on p.id = o.package_id;

comment on view public.content_review_queue_view is
  'Content Cell v1.1 read model. Cockpit reads outputs + lineage + queue bucket here.';

grant select on public.content_review_queue_view to anon, authenticated;

commit;
