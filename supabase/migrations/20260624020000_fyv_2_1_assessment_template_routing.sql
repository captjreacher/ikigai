-- FYV-2.1 assessment template routing and immutable submission metadata.

ALTER TABLE public.creator_assessment_templates
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

WITH ranked_templates AS (
  SELECT
    id,
    COALESCE(NULLIF(regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'), ''), 'template') AS base_slug,
    row_number() OVER (
      PARTITION BY COALESCE(NULLIF(regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'), ''), 'template')
      ORDER BY created_at, id
    ) AS slug_rank
  FROM public.creator_assessment_templates
  WHERE slug IS NULL OR slug = ''
)
UPDATE public.creator_assessment_templates t
SET slug = CASE
  WHEN rt.slug_rank = 1 THEN trim(both '-' FROM rt.base_slug)
  ELSE trim(both '-' FROM rt.base_slug) || '-' || rt.slug_rank::text
END
FROM ranked_templates rt
WHERE t.id = rt.id;

UPDATE public.creator_assessment_templates
SET
  slug = 'default',
  name = 'Default Creator Assessment',
  is_active = true,
  is_public = true,
  is_default = true
WHERE is_default = true;

INSERT INTO public.creator_assessment_templates (
  slug,
  name,
  description,
  is_default,
  is_active,
  is_public
)
SELECT
  'default',
  'Default Creator Assessment',
  'Public creator brand strategy assessment.',
  true,
  true,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.creator_assessment_templates WHERE slug = 'default'
);

ALTER TABLE public.creator_assessment_templates
  ALTER COLUMN slug SET NOT NULL,
  ALTER COLUMN is_public SET DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_creator_assessment_templates_slug
  ON public.creator_assessment_templates(slug);

CREATE INDEX IF NOT EXISTS idx_creator_assessment_templates_public_route
  ON public.creator_assessment_templates(slug, is_active, is_public);

ALTER TABLE public.creator_assessments
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.creator_assessment_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS template_slug text,
  ADD COLUMN IF NOT EXISTS answers jsonb,
  ADD COLUMN IF NOT EXISTS respondent jsonb,
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS onlyfans_handle text,
  ADD COLUMN IF NOT EXISTS model_name text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS consent boolean,
  ADD COLUMN IF NOT EXISTS mailing_list_opt_out boolean;

CREATE INDEX IF NOT EXISTS idx_creator_assessments_template
  ON public.creator_assessments(template_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_creator_assessments_template_slug
  ON public.creator_assessments(template_slug, created_at DESC);

DROP POLICY IF EXISTS "Public can read active creator questions" ON public.creator_question_bank;
DROP POLICY IF EXISTS "Public can read active public creator questions" ON public.creator_question_bank;
CREATE POLICY "Public can read active creator questions"
  ON public.creator_question_bank FOR SELECT
  TO anon
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1
      FROM public.creator_assessment_template_questions tq
      JOIN public.creator_assessment_templates t ON t.id = tq.template_id
      WHERE tq.question_id = creator_question_bank.id
        AND tq.is_included = true
        AND t.is_active = true
        AND t.is_public = true
    )
  );

DROP POLICY IF EXISTS "Public can read active assessment templates" ON public.creator_assessment_templates;
DROP POLICY IF EXISTS "Public can read active public assessment templates" ON public.creator_assessment_templates;
CREATE POLICY "Public can read active public assessment templates"
  ON public.creator_assessment_templates FOR SELECT
  TO anon
  USING (is_active = true AND is_public = true);

DROP POLICY IF EXISTS "Public can read assessment template questions" ON public.creator_assessment_template_questions;
DROP POLICY IF EXISTS "Public can read active public assessment template questions" ON public.creator_assessment_template_questions;
CREATE POLICY "Public can read active public assessment template questions"
  ON public.creator_assessment_template_questions FOR SELECT
  TO anon
  USING (
    is_included = true
    AND EXISTS (
      SELECT 1
      FROM public.creator_assessment_templates t
      WHERE t.id = creator_assessment_template_questions.template_id
        AND t.is_active = true
        AND t.is_public = true
    )
  );

DROP POLICY IF EXISTS "Public can read active assessment template items" ON public.creator_assessment_template_items;
DROP POLICY IF EXISTS "Public can read active public assessment template items" ON public.creator_assessment_template_items;
CREATE POLICY "Public can read active public assessment template items"
  ON public.creator_assessment_template_items FOR SELECT
  TO anon
  USING (
    is_included = true
    AND EXISTS (
      SELECT 1
      FROM public.creator_assessment_templates t
      WHERE t.id = creator_assessment_template_items.template_id
        AND t.is_active = true
        AND t.is_public = true
    )
  );

DROP POLICY IF EXISTS "Public can insert assessments" ON public.creator_assessments;
DROP POLICY IF EXISTS "Public can read assessments" ON public.creator_assessments;

CREATE OR REPLACE FUNCTION public.submit_creator_assessment(
  p_creator_profile_id uuid,
  p_template_id uuid,
  p_template_slug text,
  p_responses jsonb,
  p_answers jsonb,
  p_respondent jsonb,
  p_assessment_snapshot jsonb,
  p_creator_dna_score integer,
  p_brand_clarity_score integer,
  p_monetisation_score integer,
  p_consistency_score integer,
  p_agency_opportunity_score integer
)
RETURNS public.creator_assessments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template public.creator_assessment_templates%ROWTYPE;
  v_assessment public.creator_assessments%ROWTYPE;
BEGIN
  IF p_template_id IS NOT NULL OR p_template_slug IS NOT NULL THEN
    SELECT *
    INTO v_template
    FROM public.creator_assessment_templates
    WHERE (p_template_id IS NULL OR id = p_template_id)
      AND (p_template_slug IS NULL OR slug = p_template_slug)
      AND is_active = true
      AND is_public = true
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Assessment template is not available'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  INSERT INTO public.creator_assessments (
    creator_profile_id,
    template_id,
    template_slug,
    responses,
    answers,
    respondent,
    assessment_snapshot,
    first_name,
    last_name,
    full_name,
    email,
    onlyfans_handle,
    model_name,
    city,
    country,
    consent,
    mailing_list_opt_out,
    creator_dna_score,
    brand_clarity_score,
    monetisation_score,
    consistency_score,
    agency_opportunity_score
  )
  VALUES (
    p_creator_profile_id,
    COALESCE(v_template.id, p_template_id),
    COALESCE(v_template.slug, p_template_slug),
    p_responses,
    COALESCE(p_answers, p_responses),
    p_respondent,
    p_assessment_snapshot,
    p_respondent->>'first_name',
    p_respondent->>'last_name',
    p_respondent->>'full_name',
    lower(NULLIF(p_respondent->>'email', '')),
    NULLIF(p_respondent->>'onlyfans_handle', ''),
    NULLIF(p_respondent->>'model_name', ''),
    NULLIF(p_respondent->>'city', ''),
    NULLIF(p_respondent->>'country', ''),
    COALESCE((p_respondent->>'consent')::boolean, false),
    COALESCE((p_respondent->>'mailing_list_opt_out')::boolean, false),
    p_creator_dna_score,
    p_brand_clarity_score,
    p_monetisation_score,
    p_consistency_score,
    p_agency_opportunity_score
  )
  RETURNING * INTO v_assessment;

  RETURN v_assessment;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_creator_assessment(
  uuid,
  uuid,
  text,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  integer,
  integer,
  integer,
  integer,
  integer
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.submit_creator_assessment(
  uuid,
  uuid,
  text,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  integer,
  integer,
  integer,
  integer,
  integer
) TO anon, authenticated;
