-- FYV-2.6.1 invite lifecycle status tracking.

ALTER TABLE public.creator_assessment_links
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Created',
  ADD COLUMN IF NOT EXISTS status_updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.creator_assessment_links
  DROP CONSTRAINT IF EXISTS creator_assessment_links_status_check;

ALTER TABLE public.creator_assessment_links
  ADD CONSTRAINT creator_assessment_links_status_check
  CHECK (status IN (
    'Created',
    'Sent',
    'Opened',
    'Email Verified',
    'Started',
    'Completed',
    'Expired',
    'Revoked'
  ));

CREATE INDEX IF NOT EXISTS idx_creator_assessment_links_status_created
  ON public.creator_assessment_links(status, created_at DESC);

COMMENT ON COLUMN public.creator_assessment_links.status IS
  'Lifecycle status for FYV invite tracking: Created, Sent, Opened, Email Verified, Started, Completed, Expired, Revoked.';

COMMENT ON COLUMN public.creator_assessment_links.status_updated_at IS
  'Timestamp for the last lifecycle status change.';
