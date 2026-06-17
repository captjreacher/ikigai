-- ── Creators Domain: Profiles, Assessments, Reports, Notes, Status Events ──
-- Mgrnz-web Supabase: jqfodlzcsgfocyuawzyx

-- ── 1. creator_profiles (primary entity) ──
CREATE TABLE IF NOT EXISTS public.creator_profiles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  full_name   text NOT NULL,
  email       text,
  country     text,

  creator_stage           text NOT NULL DEFAULT 'prospect',
  status                  text NOT NULL DEFAULT 'prospect',

  archetype               text,

  creator_dna_score       integer,
  brand_clarity_score     integer,
  monetisation_score      integer,
  consistency_score       integer,
  agency_opportunity_score integer,

  management_readiness    text,

  audience_strategy       text,
  recommended_pricing_model text,

  top_vertical_1          text,
  top_vertical_2          text,
  top_vertical_3          text,

  latest_assessment_id    uuid,
  latest_report_id        uuid,

  ofmanager_creator_id    text,

  notes                   text,

  CONSTRAINT valid_status CHECK (status IN (
    'prospect','assessed','qualified','interviewed','accepted',
    'onboarding','active','paused','offboarded'
  )),
  CONSTRAINT valid_readiness CHECK (
    management_readiness IS NULL OR management_readiness IN (
      'Scale Candidate','Ready Now','Needs Foundation','Hobby Creator'
    )
  )
);

-- ── 2. creator_assessments ──
CREATE TABLE IF NOT EXISTS public.creator_assessments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_profile_id uuid NOT NULL REFERENCES public.creator_profiles(id) ON DELETE CASCADE,
  created_at        timestamptz NOT NULL DEFAULT now(),

  responses         jsonb NOT NULL,

  creator_dna_score       integer,
  brand_clarity_score     integer,
  monetisation_score      integer,
  consistency_score       integer,
  agency_opportunity_score integer
);

CREATE INDEX idx_assessments_profile ON public.creator_assessments(creator_profile_id, created_at DESC);

-- ── 3. creator_reports ──
CREATE TABLE IF NOT EXISTS public.creator_reports (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_profile_id uuid NOT NULL REFERENCES public.creator_profiles(id) ON DELETE CASCADE,
  created_at        timestamptz NOT NULL DEFAULT now(),

  report_slug       text UNIQUE NOT NULL,
  report_json       jsonb NOT NULL,
  version           text NOT NULL DEFAULT '1.0'
);

CREATE INDEX idx_reports_profile ON public.creator_reports(creator_profile_id, created_at DESC);
CREATE INDEX idx_reports_slug ON public.creator_reports(report_slug);

-- ── 4. creator_notes ──
CREATE TABLE IF NOT EXISTS public.creator_notes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_profile_id uuid NOT NULL REFERENCES public.creator_profiles(id) ON DELETE CASCADE,
  created_at        timestamptz NOT NULL DEFAULT now(),
  note              text NOT NULL
);

CREATE INDEX idx_notes_profile ON public.creator_notes(creator_profile_id, created_at DESC);

-- ── 5. creator_status_events ──
CREATE TABLE IF NOT EXISTS public.creator_status_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_profile_id uuid NOT NULL REFERENCES public.creator_profiles(id) ON DELETE CASCADE,
  created_at        timestamptz NOT NULL DEFAULT now(),
  event_type        text NOT NULL,
  details           jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX idx_status_events_profile ON public.creator_status_events(creator_profile_id, created_at DESC);

-- ── updated_at trigger ──
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_creator_profiles_updated_at ON public.creator_profiles;
CREATE TRIGGER trg_creator_profiles_updated_at
  BEFORE UPDATE ON public.creator_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS: Enable on all tables ──
ALTER TABLE public.creator_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_status_events ENABLE ROW LEVEL SECURITY;

-- ── RLS Policies ──

-- Public (anon): can INSERT creator_profiles (assessment wizard creates them)
-- Public (anon): can INSERT creator_assessments and creator_reports
-- Public (anon): can SELECT profiles and reports by id (for public report pages)

-- Authenticated (agency users): full access to all tables

-- ── creator_profiles policies ──
CREATE POLICY "Public can insert creator profiles"
  ON public.creator_profiles FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Public can read creator profiles"
  ON public.creator_profiles FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Authenticated full access profiles"
  ON public.creator_profiles FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── creator_assessments policies ──
CREATE POLICY "Public can insert assessments"
  ON public.creator_assessments FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Public can read assessments"
  ON public.creator_assessments FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Authenticated full access assessments"
  ON public.creator_assessments FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── creator_reports policies ──
CREATE POLICY "Public can insert reports"
  ON public.creator_reports FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Public can read reports"
  ON public.creator_reports FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Authenticated full access reports"
  ON public.creator_reports FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── creator_notes policies ──
CREATE POLICY "Authenticated full access notes"
  ON public.creator_notes FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── creator_status_events policies ──
CREATE POLICY "Public can insert status events"
  ON public.creator_status_events FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Public can read status events"
  ON public.creator_status_events FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Authenticated full access status events"
  ON public.creator_status_events FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
