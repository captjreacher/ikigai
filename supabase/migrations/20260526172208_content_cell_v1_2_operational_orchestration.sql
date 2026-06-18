-- Content Cell v1.2 operational orchestration layer.
-- Deterministic pipeline:
-- content_sources -> content_insights -> content_assets -> work queues
-- -> approvals -> publication.

begin;

create table if not exists public.content_sources (
  id uuid primary key default gen_random_uuid(),
  source_type text not null default 'operator_draft',
  source_system text not null default 'cockpit',
  source_id text,
  title text,
  body_markdown text,
  summary text,
  tags jsonb not null default '[]'::jsonb,
  status text not null default 'created'
    check (status in ('created', 'interpreted', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_insights (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.content_sources(id) on delete set null,
  insight_key text,
  title text,
  summary text,
  interpretation jsonb not null default '{}'::jsonb,
  confidence numeric,
  status text not null default 'ready'
    check (status in ('ready', 'asset_generation_requested', 'assets_generated', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_assets (
  id uuid primary key default gen_random_uuid(),
  insight_id uuid references public.content_insights(id) on delete set null,
  source_id uuid references public.content_sources(id) on delete set null,
  asset_type text not null,
  output_type text,
  title text,
  body text,
  status text not null default 'draft_generated'
    check (status in (
      'draft_requested',
      'draft_generated',
      'approved',
      'rejected',
      'revision_requested',
      'needs_paperclip',
      'published',
      'archived'
    )),
  review_state text not null default 'draft_generated'
    check (review_state in (
      'draft_generated',
      'strong',
      'needs_rewrite',
      'off_voice',
      'ceo_review',
      'approved',
      'published',
      'archived'
    )),
  workflow_stage text,
  assigned_role text,
  assigned_agent text,
  editorial_score numeric,
  voice_alignment text,
  review_notes jsonb not null default '{}'::jsonb,
  parent_asset_id uuid references public.content_assets(id) on delete set null,
  lineage_depth integer not null default 0 check (lineage_depth >= 0),
  generation_reason text not null default 'insight_template',
  derived_from_event_id uuid references public.events(id) on delete set null,
  human_required boolean not null default true,
  approval_required boolean not null default true,
  autonomous_allowed boolean not null default false,
  publish_blocked boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.content_assets
  add column if not exists parent_asset_id uuid references public.content_assets(id) on delete set null,
  add column if not exists lineage_depth integer not null default 0,
  add column if not exists generation_reason text not null default 'insight_template',
  add column if not exists derived_from_event_id uuid references public.events(id) on delete set null,
  add column if not exists human_required boolean not null default true,
  add column if not exists approval_required boolean not null default true,
  add column if not exists autonomous_allowed boolean not null default false,
  add column if not exists publish_blocked boolean not null default true;

alter table public.content_outputs
  add column if not exists parent_asset_id uuid references public.content_assets(id) on delete set null,
  add column if not exists lineage_depth integer not null default 0,
  add column if not exists derived_from_event_id uuid references public.events(id) on delete set null,
  add column if not exists human_required boolean not null default true,
  add column if not exists approval_required boolean not null default true,
  add column if not exists autonomous_allowed boolean not null default false,
  add column if not exists publish_blocked boolean not null default true;

create table if not exists public.content_asset_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null,
  asset_type text not null default 'content_asset',
  output_type text not null,
  channel text,
  format text,
  template_version integer not null default 1,
  priority integer not null default 100,
  active boolean not null default true,
  required_metadata_keys jsonb not null default '[]'::jsonb,
  template_config jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_key, template_version)
);

create table if not exists public.content_work_queue (
  id uuid primary key default gen_random_uuid(),
  queue_type text not null,
  entity_type text not null,
  entity_id text not null,
  priority integer not null default 100,
  status text not null default 'queued'
    check (status in ('queued', 'in_progress', 'blocked', 'completed', 'cancelled')),
  assigned_role text,
  assigned_agent text,
  blocked_reason text,
  queued_at timestamptz not null default now(),
  due_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  breached_at timestamptz,
  source_event_id uuid references public.events(id) on delete set null,
  human_required boolean not null default true,
  approval_required boolean not null default true,
  autonomous_allowed boolean not null default false,
  publish_blocked boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'content_assets_governance_publish_check'
      and conrelid = 'public.content_assets'::regclass
  ) then
    alter table public.content_assets
      add constraint content_assets_governance_publish_check
      check (
        status <> 'published'
        or (
          review_state = 'published'
          and human_required
          and approval_required
          and not autonomous_allowed
          and not publish_blocked
        )
      ) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'content_outputs_governance_publish_check'
      and conrelid = 'public.content_outputs'::regclass
  ) then
    alter table public.content_outputs
      add constraint content_outputs_governance_publish_check
      check (
        status <> 'published'
        or (
          coalesce(review_state, 'published') = 'published'
          and human_required
          and approval_required
          and not autonomous_allowed
          and not publish_blocked
        )
      ) not valid;
  end if;
end $$;

create unique index if not exists content_sources_source_key
  on public.content_sources (source_system, source_type, source_id)
  where source_id is not null;

create unique index if not exists content_insights_source_insight_key
  on public.content_insights (source_id, insight_key)
  where source_id is not null and insight_key is not null;

create unique index if not exists content_assets_insight_template_key
  on public.content_assets (insight_id, output_type, generation_reason)
  where insight_id is not null and generation_reason = 'insight_template';

create index if not exists content_assets_parent_asset_idx
  on public.content_assets (parent_asset_id);

create index if not exists content_assets_lineage_idx
  on public.content_assets (lineage_depth, parent_asset_id);

create index if not exists content_assets_review_idx
  on public.content_assets (review_state, status, assigned_role);

create index if not exists content_asset_templates_active_priority_idx
  on public.content_asset_templates (active, priority, output_type);

create index if not exists content_work_queue_status_priority_idx
  on public.content_work_queue (status, priority, due_at);

create index if not exists content_work_queue_assignee_idx
  on public.content_work_queue (assigned_role, assigned_agent, status);

create index if not exists content_work_queue_entity_idx
  on public.content_work_queue (entity_type, entity_id);

create unique index if not exists content_work_queue_active_unique
  on public.content_work_queue (queue_type, entity_type, entity_id)
  where status in ('queued', 'in_progress', 'blocked');

insert into public.content_asset_templates (
  template_key,
  asset_type,
  output_type,
  channel,
  format,
  template_version,
  priority,
  template_config,
  metadata
)
values
  ('linkedin_personal_post_v1', 'content_asset', 'linkedin_personal_post', 'linkedin', 'post', 1, 10, '{"deterministic": true}'::jsonb, '{"seeded_by": "content_cell_v1_2"}'::jsonb),
  ('linkedin_company_post_v1', 'content_asset', 'linkedin_company_post', 'linkedin', 'post', 1, 20, '{"deterministic": true}'::jsonb, '{"seeded_by": "content_cell_v1_2"}'::jsonb),
  ('linkedin_company_comment_v1', 'content_asset', 'linkedin_company_comment', 'linkedin', 'comment', 1, 30, '{"deterministic": true}'::jsonb, '{"seeded_by": "content_cell_v1_2"}'::jsonb),
  ('carousel_outline_v1', 'content_asset', 'carousel_outline', 'linkedin', 'carousel_outline', 1, 40, '{"deterministic": true}'::jsonb, '{"seeded_by": "content_cell_v1_2"}'::jsonb),
  ('mgrnz_blog_article_v1', 'content_asset', 'mgrnz_blog_article', 'web', 'article', 1, 50, '{"deterministic": true}'::jsonb, '{"seeded_by": "content_cell_v1_2"}'::jsonb)
on conflict (template_key, template_version) do update
set
  active = true,
  priority = excluded.priority,
  template_config = public.content_asset_templates.template_config || excluded.template_config,
  metadata = public.content_asset_templates.metadata || excluded.metadata,
  updated_at = now();

create or replace function public.enqueue_content_work(
  p_queue_type text,
  p_entity_type text,
  p_entity_id text,
  p_priority integer default 100,
  p_assigned_role text default null,
  p_assigned_agent text default null,
  p_source_event_id uuid default null,
  p_due_at timestamptz default null,
  p_human_required boolean default true,
  p_approval_required boolean default true,
  p_autonomous_allowed boolean default false,
  p_publish_blocked boolean default true,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_queue_id uuid;
begin
  insert into public.content_work_queue (
    queue_type,
    entity_type,
    entity_id,
    priority,
    assigned_role,
    assigned_agent,
    source_event_id,
    due_at,
    human_required,
    approval_required,
    autonomous_allowed,
    publish_blocked,
    metadata
  )
  values (
    p_queue_type,
    p_entity_type,
    p_entity_id,
    coalesce(p_priority, 100),
    p_assigned_role,
    p_assigned_agent,
    p_source_event_id,
    p_due_at,
    coalesce(p_human_required, true),
    coalesce(p_approval_required, true),
    coalesce(p_autonomous_allowed, false),
    coalesce(p_publish_blocked, true),
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (queue_type, entity_type, entity_id)
    where status in ('queued', 'in_progress', 'blocked')
  do update
  set
    priority = least(public.content_work_queue.priority, excluded.priority),
    assigned_role = coalesce(excluded.assigned_role, public.content_work_queue.assigned_role),
    assigned_agent = coalesce(excluded.assigned_agent, public.content_work_queue.assigned_agent),
    source_event_id = coalesce(excluded.source_event_id, public.content_work_queue.source_event_id),
    due_at = coalesce(public.content_work_queue.due_at, excluded.due_at),
    human_required = public.content_work_queue.human_required or excluded.human_required,
    approval_required = public.content_work_queue.approval_required or excluded.approval_required,
    autonomous_allowed = public.content_work_queue.autonomous_allowed and excluded.autonomous_allowed,
    publish_blocked = public.content_work_queue.publish_blocked or excluded.publish_blocked,
    metadata = public.content_work_queue.metadata || excluded.metadata,
    updated_at = now()
  returning id into v_queue_id;

  return v_queue_id;
end;
$$;

create or replace function public.handle_content_event_queue()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_entity_id text;
begin
  v_entity_id := coalesce(new.entity_id, new.payload ->> 'source_id', new.payload ->> 'insight_id', new.payload ->> 'asset_id', new.payload ->> 'output_id');

  if new.event_type = 'content.source.created' then
    perform public.enqueue_content_work(
      'interpret_source',
      'content_source',
      v_entity_id,
      20,
      'content_editor_ba',
      null,
      new.id,
      new.created_at + interval '4 hours',
      true,
      true,
      false,
      true,
      jsonb_build_object('event_type', new.event_type)
    );
  elsif new.event_type = 'content.source.interpreted' then
    perform public.enqueue_content_work(
      'generate_assets',
      'content_insight',
      coalesce(new.payload ->> 'insight_id', v_entity_id),
      30,
      'content_writer',
      'generate-assets-from-insight',
      new.id,
      new.created_at + interval '8 hours',
      true,
      true,
      false,
      true,
      jsonb_build_object('event_type', new.event_type)
    );
  elsif new.event_type = 'content.asset.generated' then
    perform public.enqueue_content_work(
      'review_asset',
      'content_asset',
      coalesce(new.payload ->> 'asset_id', v_entity_id),
      40,
      'content_editor_ba',
      null,
      new.id,
      new.created_at + interval '1 day',
      true,
      true,
      false,
      true,
      jsonb_build_object('event_type', new.event_type, 'output_type', new.payload ->> 'output_type')
    );
  elsif new.event_type in ('content.output.generated', 'content.output.regenerated') then
    perform public.enqueue_content_work(
      'review_asset',
      'content_output',
      coalesce(new.payload ->> 'output_id', v_entity_id),
      40,
      'content_editor_ba',
      null,
      new.id,
      new.created_at + interval '1 day',
      true,
      true,
      false,
      true,
      jsonb_build_object('event_type', new.event_type, 'output_type', new.payload ->> 'output_type')
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_content_event_queue on public.events;
create trigger trg_content_event_queue
after insert on public.events
for each row
execute function public.handle_content_event_queue();

create or replace function public.handle_content_asset_review_queue()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.review_state is distinct from old.review_state then
    if new.review_state = 'ceo_review' then
      perform public.enqueue_content_work('approval_review', 'content_asset', new.id::text, 10, 'ceo_approver', null, new.derived_from_event_id, now() + interval '1 day', true, true, false, true, jsonb_build_object('review_state', new.review_state));
    elsif new.review_state in ('needs_rewrite', 'off_voice') then
      perform public.enqueue_content_work('revise_asset', 'content_asset', new.id::text, 15, 'content_writer', null, new.derived_from_event_id, now() + interval '1 day', true, true, false, true, jsonb_build_object('review_state', new.review_state));
    elsif new.review_state = 'approved' then
      perform public.enqueue_content_work('publication_readiness', 'content_asset', new.id::text, 50, 'content_final_editor', null, new.derived_from_event_id, now() + interval '2 days', true, true, false, true, jsonb_build_object('review_state', new.review_state));
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_content_asset_review_queue on public.content_assets;
create trigger trg_content_asset_review_queue
after update of review_state on public.content_assets
for each row
execute function public.handle_content_asset_review_queue();

create or replace function public.handle_content_output_review_queue()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.review_state is distinct from old.review_state then
    if new.review_state = 'ceo_review' then
      perform public.enqueue_content_work('approval_review', 'content_output', new.id::text, 10, 'ceo_approver', null, new.derived_from_event_id, now() + interval '1 day', true, true, false, true, jsonb_build_object('review_state', new.review_state));
    elsif new.review_state in ('needs_rewrite', 'off_voice') then
      perform public.enqueue_content_work('revise_asset', 'content_output', new.id::text, 15, 'content_writer', null, new.derived_from_event_id, now() + interval '1 day', true, true, false, true, jsonb_build_object('review_state', new.review_state));
    elsif new.review_state = 'approved' then
      perform public.enqueue_content_work('publication_readiness', 'content_output', new.id::text, 50, 'content_final_editor', null, new.derived_from_event_id, now() + interval '2 days', true, true, false, true, jsonb_build_object('review_state', new.review_state));
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_content_output_review_queue on public.content_outputs;
create trigger trg_content_output_review_queue
after update of review_state on public.content_outputs
for each row
execute function public.handle_content_output_review_queue();

drop function if exists public.generate_content_assets_from_insight(uuid, uuid);

create or replace function public.generate_content_assets_from_insight(
  p_insight_id uuid,
  p_event_id uuid default null
)
returns table(asset_id uuid, asset_output_type text, template_key text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  with insight as (
    select i.*, s.title as source_title, s.body_markdown as source_body
    from public.content_insights i
    left join public.content_sources s on s.id = i.source_id
    where i.id = p_insight_id
  ),
  inserted as (
    insert into public.content_assets (
      insight_id,
      source_id,
      asset_type,
      output_type,
      title,
      body,
      status,
      review_state,
      workflow_stage,
      assigned_role,
      generation_reason,
      derived_from_event_id,
      human_required,
      approval_required,
      autonomous_allowed,
      publish_blocked,
      metadata
    )
    select
      insight.id,
      insight.source_id,
      t.asset_type,
      t.output_type,
      coalesce(insight.title, insight.source_title, 'Untitled content insight') || ' / ' || replace(t.output_type, '_', ' '),
      concat_ws(E'\n\n',
        coalesce(insight.summary, insight.source_body, 'No source summary captured.'),
        'Template: ' || t.template_key,
        'Draft generated deterministically from the interpreted insight. Human review and approval remain required before publication.'
      ),
      'draft_generated',
      'draft_generated',
      'writer_draft_ready',
      'content_editor_ba',
      'insight_template',
      p_event_id,
      true,
      true,
      false,
      true,
      jsonb_build_object(
        'template_id', t.id,
        'template_key', t.template_key,
        'template_version', t.template_version,
        'deterministic', true
      )
    from insight
    join public.content_asset_templates t on t.active
    order by t.priority, t.template_key
    on conflict (insight_id, output_type, generation_reason)
      where insight_id is not null and generation_reason = 'insight_template'
    do update
    set
      metadata = public.content_assets.metadata || excluded.metadata,
      updated_at = now()
    returning
      public.content_assets.id as asset_id,
      public.content_assets.output_type,
      public.content_assets.metadata ->> 'template_key' as template_key
  )
  select inserted.asset_id, inserted.output_type, inserted.template_key
  from inserted;
end;
$$;

create or replace function public.guard_content_asset_governance()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'published' and (
    new.review_state <> 'published'
    or not new.human_required
    or not new.approval_required
    or new.autonomous_allowed
    or new.publish_blocked
  ) then
    raise exception 'content_asset_publish_governance_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_content_asset_governance on public.content_assets;
create trigger trg_guard_content_asset_governance
before insert or update of status, review_state, human_required, approval_required, autonomous_allowed, publish_blocked
on public.content_assets
for each row
execute function public.guard_content_asset_governance();

create or replace function public.guard_content_output_governance()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'published' and (
    coalesce(new.review_state, 'published') <> 'published'
    or not new.human_required
    or not new.approval_required
    or new.autonomous_allowed
    or new.publish_blocked
  ) then
    raise exception 'content_output_publish_governance_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_content_output_governance on public.content_outputs;
create trigger trg_guard_content_output_governance
before insert or update of status, review_state, human_required, approval_required, autonomous_allowed, publish_blocked
on public.content_outputs
for each row
execute function public.guard_content_output_governance();

drop view if exists public.content_asset_lineage_view;
create view public.content_asset_lineage_view
with (security_invoker = true)
as
with recursive lineage as (
  select
    a.id as asset_id,
    a.id as descendant_asset_id,
    a.parent_asset_id,
    0 as distance_from_descendant,
    a.lineage_depth,
    a.generation_reason,
    a.derived_from_event_id,
    a.output_type,
    a.status,
    a.review_state,
    a.created_at
  from public.content_assets a
  union all
  select
    parent.id as asset_id,
    lineage.descendant_asset_id,
    parent.parent_asset_id,
    lineage.distance_from_descendant + 1,
    parent.lineage_depth,
    parent.generation_reason,
    parent.derived_from_event_id,
    parent.output_type,
    parent.status,
    parent.review_state,
    parent.created_at
  from lineage
  join public.content_assets parent on parent.id = lineage.parent_asset_id
  where lineage.distance_from_descendant < 25
)
select *
from lineage;

alter table public.content_sources enable row level security;
alter table public.content_insights enable row level security;
alter table public.content_assets enable row level security;
alter table public.content_asset_templates enable row level security;
alter table public.content_work_queue enable row level security;

grant select on public.content_sources to authenticated;
grant select on public.content_insights to authenticated;
grant select on public.content_assets to authenticated;
grant select on public.content_asset_templates to authenticated;
grant select on public.content_work_queue to authenticated;
grant select on public.content_asset_lineage_view to authenticated;

drop policy if exists "authenticated read content sources" on public.content_sources;
create policy "authenticated read content sources"
  on public.content_sources for select to authenticated using (true);

drop policy if exists "authenticated read content insights" on public.content_insights;
create policy "authenticated read content insights"
  on public.content_insights for select to authenticated using (true);

drop policy if exists "authenticated read content assets" on public.content_assets;
create policy "authenticated read content assets"
  on public.content_assets for select to authenticated using (true);

drop policy if exists "authenticated read content asset templates" on public.content_asset_templates;
create policy "authenticated read content asset templates"
  on public.content_asset_templates for select to authenticated using (true);

drop policy if exists "authenticated read content work queue" on public.content_work_queue;
create policy "authenticated read content work queue"
  on public.content_work_queue for select to authenticated using (true);

comment on table public.content_work_queue is
  'Deterministic Content Cell operational queue for source interpretation, asset fanout, review, approval, and publication readiness.';

comment on table public.content_asset_templates is
  'Deterministic template definitions used to fan out content assets from reusable insights.';

comment on view public.content_asset_lineage_view is
  'Recursive asset lineage view from each descendant asset back through parent assets.';

commit;




