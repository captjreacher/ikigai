-- FYV-3.0 Creator Intelligence Engine foundations.

ALTER TABLE public.creator_reports
  DROP CONSTRAINT IF EXISTS creator_reports_report_tier_check;

ALTER TABLE public.creator_reports
  ADD CONSTRAINT creator_reports_report_tier_check
  CHECK (report_tier IN ('free', 'premium', 'agency'))
  NOT VALID;

ALTER TABLE public.creator_reports
  VALIDATE CONSTRAINT creator_reports_report_tier_check;

ALTER TABLE public.creator_question_bank
  DROP CONSTRAINT IF EXISTS valid_creator_question_type;

ALTER TABLE public.creator_question_bank
  ADD CONSTRAINT valid_creator_question_type
  CHECK (
    question_type IN (
      'short_text',
      'long_text',
      'textarea',
      'single_choice',
      'multi_choice',
      'boolean',
      'scale',
      'scenario_ranking'
    )
  );

ALTER TABLE public.creator_question_bank
  DROP CONSTRAINT IF EXISTS valid_creator_show_when_operator;

ALTER TABLE public.creator_question_bank
  ADD CONSTRAINT valid_creator_show_when_operator
  CHECK (
    show_when_operator IN ('equals', 'includes', 'includes_any', 'not_equals')
  );

COMMENT ON COLUMN public.creator_question_bank.config IS
  'Question display and intelligence metadata. FYV-3.0 supports evidence, trait, archetype hypothesis, validation mode, and conditional metadata here.';

COMMENT ON COLUMN public.creator_reports.report_tier IS
  'Report presentation tier generated from Creator DNA. Supported values: free, premium, agency.';
