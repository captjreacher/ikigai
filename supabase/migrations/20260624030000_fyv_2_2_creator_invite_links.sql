-- FYV-2.2 creator-specific invite links for attributed assessments.

CREATE TABLE IF NOT EXISTS public.creator_assessment_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.creator_assessment_templates(id) ON DELETE CASCADE,
  invite_code text NOT NULL UNIQUE,
  creator_name text NOT NULL,
  creator_email text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_creator_assessment_links_invite_code
  ON public.creator_assessment_links(invite_code);

CREATE INDEX IF NOT EXISTS idx_creator_assessment_links_template_id
  ON public.creator_assessment_links(template_id);

ALTER TABLE public.creator_assessment_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read active creator assessment links" ON public.creator_assessment_links;
CREATE POLICY "Public can read active creator assessment links"
  ON public.creator_assessment_links FOR SELECT
  TO anon
  USING (
    is_active = true
    AND (expires_at IS NULL OR expires_at > now())
    AND EXISTS (
      SELECT 1
      FROM public.creator_assessment_templates t
      WHERE t.id = creator_assessment_links.template_id
        AND t.is_active = true
        AND t.is_public = true
    )
  );

DROP POLICY IF EXISTS "Authenticated full access creator assessment links" ON public.creator_assessment_links;
CREATE POLICY "Authenticated full access creator assessment links"
  ON public.creator_assessment_links FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.creator_assessments
  ADD COLUMN IF NOT EXISTS invite_link_id uuid REFERENCES public.creator_assessment_links(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invite_code text,
  ADD COLUMN IF NOT EXISTS creator_name text;

CREATE INDEX IF NOT EXISTS idx_creator_assessments_invite_link
  ON public.creator_assessments(invite_link_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_creator_assessments_invite_code
  ON public.creator_assessments(invite_code, created_at DESC);

DROP FUNCTION IF EXISTS public.submit_creator_assessment(
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
);

CREATE OR REPLACE FUNCTION public.submit_creator_assessment(
  p_creator_profile_id uuid,
  p_template_id uuid,
  p_template_slug text,
  p_invite_link_id uuid,
  p_invite_code text,
  p_creator_name text,
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
  v_invite public.creator_assessment_links%ROWTYPE;
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

  IF p_invite_link_id IS NOT NULL OR p_invite_code IS NOT NULL THEN
    SELECT *
    INTO v_invite
    FROM public.creator_assessment_links
    WHERE (p_invite_link_id IS NULL OR id = p_invite_link_id)
      AND (p_invite_code IS NULL OR invite_code = p_invite_code)
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
      AND (v_template.id IS NULL OR template_id = v_template.id)
    LIMIT 1;
  END IF;

  INSERT INTO public.creator_assessments (
    creator_profile_id,
    template_id,
    template_slug,
    invite_link_id,
    invite_code,
    creator_name,
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
    v_invite.id,
    v_invite.invite_code,
    COALESCE(v_invite.creator_name, p_creator_name),
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
  uuid,
  text,
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
  uuid,
  text,
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
