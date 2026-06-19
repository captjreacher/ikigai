CREATE TABLE IF NOT EXISTS public.creator_dna_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_profile_id uuid NOT NULL REFERENCES public.creator_profiles(id) ON DELETE CASCADE,
  assessment_id uuid NOT NULL REFERENCES public.creator_assessments(id) ON DELETE CASCADE,
  creator_dna_primary text NOT NULL,
  creator_dna_secondary text NOT NULL,
  confidence integer NOT NULL,
  fantasy_archetype text NOT NULL,
  archetype_confidence integer NOT NULL,
  authenticity_band text NOT NULL,
  authenticity_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  growth_constraints jsonb NOT NULL DEFAULT '[]'::jsonb,
  monetisation_readiness text NOT NULL,
  agency_opportunity_score integer NOT NULL,
  agency_opportunity_band text NOT NULL,
  summary text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT creator_dna_profiles_unique_assessment UNIQUE (assessment_id),
  CONSTRAINT creator_dna_profiles_confidence_range CHECK (confidence BETWEEN 0 AND 100),
  CONSTRAINT creator_dna_profiles_archetype_confidence_range CHECK (archetype_confidence BETWEEN 0 AND 100),
  CONSTRAINT creator_dna_profiles_agency_score_range CHECK (agency_opportunity_score BETWEEN 0 AND 100),
  CONSTRAINT creator_dna_profiles_authenticity_band_check CHECK (
    authenticity_band IN ('High Authenticity', 'Moderate Authenticity', 'Potential Conflict')
  ),
  CONSTRAINT creator_dna_profiles_monetisation_readiness_check CHECK (
    monetisation_readiness IN ('Low', 'Developing', 'Ready', 'Advanced')
  ),
  CONSTRAINT creator_dna_profiles_agency_band_check CHECK (
    agency_opportunity_band IN ('High Priority', 'Qualified', 'Needs Development', 'Not Suitable Yet')
  )
);

CREATE INDEX IF NOT EXISTS idx_creator_dna_profiles_creator
  ON public.creator_dna_profiles(creator_profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_creator_dna_profiles_agency_band
  ON public.creator_dna_profiles(agency_opportunity_band, agency_opportunity_score DESC);

ALTER TABLE public.creator_dna_profiles ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.creator_dna_profiles TO anon;
GRANT ALL ON public.creator_dna_profiles TO authenticated;

CREATE POLICY "Public can insert creator dna profiles"
  ON public.creator_dna_profiles FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Public can read creator dna profiles"
  ON public.creator_dna_profiles FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Authenticated full access creator dna profiles"
  ON public.creator_dna_profiles FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

WITH resolved_template AS (
  SELECT id FROM public.creator_assessment_templates WHERE name = 'Default Creator Assessment' LIMIT 1
),
creator_dna_questions(question_key, sort_order) AS (
  VALUES
    ('creator_motivation', 61),
    ('sexual_connection_to_content', 62),
    ('desired_fantasy_image', 63),
    ('full_nude_expansion', 71),
    ('fetish_description', 72),
    ('creator_weaknesses', 91)
)
INSERT INTO public.creator_assessment_template_questions (template_id, question_id, is_included, sort_order)
SELECT rt.id, q.id, true, cq.sort_order
FROM resolved_template rt
JOIN creator_dna_questions cq ON true
JOIN public.creator_question_bank q ON q.question_key = cq.question_key
ON CONFLICT (template_id, question_id) DO UPDATE SET
  is_included = EXCLUDED.is_included,
  sort_order = EXCLUDED.sort_order;
