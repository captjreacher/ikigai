-- Allow Content Cell v1 review statuses while preserving the existing
-- content output status vocabulary.

begin;

alter table public.content_outputs
  drop constraint if exists chk_output_status;

alter table public.content_outputs
  add constraint chk_output_status
  check (
    status in (
      'draft_requested',
      'draft_generated',
      'approved',
      'rejected',
      'needs_revision',
      'revision_requested',
      'needs_paperclip',
      'published',
      'archived'
    )
  );

commit;
