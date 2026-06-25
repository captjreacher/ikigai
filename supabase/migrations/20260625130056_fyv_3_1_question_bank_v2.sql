-- FYV-3.1 Question Bank v2 and archetype scenario matrices.

ALTER TABLE public.creator_assessment_links
  ADD COLUMN IF NOT EXISTS report_tier text NOT NULL DEFAULT 'free';

ALTER TABLE public.creator_assessment_links
  DROP CONSTRAINT IF EXISTS creator_assessment_links_report_tier_check;

ALTER TABLE public.creator_assessment_links
  ADD CONSTRAINT creator_assessment_links_report_tier_check
  CHECK (report_tier IN ('free', 'premium', 'agency'));

COMMENT ON COLUMN public.creator_assessment_links.report_tier IS
  'Report tier requested by the cockpit-created invite. Public routes default to free and do not expose agency reports.';

DROP FUNCTION IF EXISTS public.get_creator_assessment_invite_status(text);
CREATE OR REPLACE FUNCTION public.get_creator_assessment_invite_status(
  p_invite_code text
)
RETURNS TABLE (
  id uuid,
  template_id uuid,
  creator_profile_id uuid,
  invite_code text,
  creator_name text,
  creator_email text,
  notes text,
  report_tier text,
  status text,
  status_updated_at timestamptz,
  is_active boolean,
  created_at timestamptz,
  expires_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    link.id,
    link.template_id,
    link.creator_profile_id,
    link.invite_code,
    link.creator_name,
    link.creator_email,
    NULL::text AS notes,
    link.report_tier,
    link.status,
    link.status_updated_at,
    link.is_active,
    link.created_at,
    link.expires_at
  FROM public.creator_assessment_links link
  WHERE link.invite_code = NULLIF(trim(p_invite_code), '')
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_creator_assessment_invite_status(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_creator_assessment_invite_status(text) TO anon, authenticated;

WITH section_seed(title, description, sort_order) AS (
  VALUES
    ('Identity', 'Natural creator identity, motivations, and visibility style.', 1000),
    ('Positioning', 'Archetype hypotheses and scenario validation.', 1100),
    ('Audience', 'Fan relationship style and audience fit.', 1200),
    ('Content Engine', 'Repeatable content systems and vertical validation.', 1300),
    ('Commercial Readiness', 'Offer, boundaries, and monetisation follow-up.', 1400),
    ('Growth Potential', 'Coachability, support needs, and scale readiness.', 1500),
    ('Future Vision', 'Near-term direction and long-term creator intent.', 1600)
),
default_template AS (
  SELECT id
  FROM public.creator_assessment_templates
  WHERE is_default = true
  ORDER BY created_at DESC
  LIMIT 1
),
insert_sections AS (
  INSERT INTO public.creator_assessment_template_items (
    template_id,
    item_type,
    question_id,
    title,
    description,
    is_included,
    sort_order
  )
  SELECT
    dt.id,
    'section_heading',
    NULL,
    ss.title,
    ss.description,
    true,
    ss.sort_order
  FROM default_template dt
  CROSS JOIN section_seed ss
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.creator_assessment_template_items existing
    WHERE existing.template_id = dt.id
      AND existing.item_type = 'section_heading'
      AND existing.title = ss.title
  )
  RETURNING id
),
question_seed(
  question_key,
  response_key,
  question_text,
  help_text,
  section,
  question_type,
  scoring_dimension,
  parent_question_key,
  show_when_value,
  show_when_operator,
  options,
  config,
  sort_order
) AS (
  VALUES
    (
      'v2_identity_creator_origin',
      'creator_origin_story',
      'What first made you curious about becoming a creator?',
      'Share the real reason, even if it is practical, emotional, creative, financial, or a mix.',
      'Identity',
      'long_text',
      'identity',
      NULL,
      NULL,
      'equals',
      '[]'::jsonb,
      '{"rows":4,"evidence":{"dimensions":["identity","future_vision"],"traits":["authenticity","coachability"],"reportHooks":["motivation_depth","creator_origin"]}}'::jsonb,
      1010
    ),
    (
      'v2_identity_visibility_style',
      'visibility_style',
      'When attention is on you, what feels most natural?',
      NULL,
      'Identity',
      'single_choice',
      'visibility',
      NULL,
      NULL,
      'equals',
      '[{"value":"playful_attention","label":"Leaning into it playfully"},{"value":"warm_connection","label":"Making it feel personal and familiar"},{"value":"controlled_performance","label":"Staying in control of the performance"},{"value":"low_visibility","label":"Keeping things softer and lower visibility"}]'::jsonb,
      '{"required":true,"evidence":{"dimensions":["confidence"],"traits":["visibility_comfort","social_energy","authenticity"],"reportHooks":["visibility_style"]}}'::jsonb,
      1020
    ),
    (
      'v2_positioning_creator_energy',
      'creator_energy',
      'Which creator energy sounds closest to you right now?',
      NULL,
      'Positioning',
      'single_choice',
      'positioning',
      NULL,
      NULL,
      'equals',
      '[{"value":"relatable_and_familiar","label":"Relatable and familiar"},{"value":"social_and_high_energy","label":"Social and high energy"},{"value":"disciplined_and_visual","label":"Disciplined and visual"},{"value":"commanding_and_controlled","label":"Commanding and controlled"},{"value":"stylised_and_glamorous","label":"Stylised and glamorous"},{"value":"niche_and_playful","label":"Niche and playful"}]'::jsonb,
      '{"required":true,"evidence":{"dimensions":["positioning"],"traits":["positioning_clarity","authenticity"],"reportHooks":["creator_energy"]}}'::jsonb,
      1110
    ),
    (
      'v2_scenario_girl_next_door',
      'scenario_girl_next_door',
      'Rank the Girl Next Door scenarios you could sustain most naturally.',
      'Pick in the order that feels easiest to repeat.',
      'Positioning',
      'scenario_ranking',
      'archetype_validation',
      'persona_occupation',
      'Girl Next Door,Soft Girlfriend Experience',
      'includes_any',
      '[{"value":"daily_life_updates","label":"Daily-life updates that feel casual and real"},{"value":"private_check_ins","label":"Private check-ins with loyal fans"},{"value":"honest_storytime","label":"Honest storytime content"},{"value":"soft_tease","label":"Soft tease built around familiarity"}]'::jsonb,
      '{"maxSelections":4,"evidence":{"dimensions":["archetype_validation","audience"],"traits":["authenticity","emotional_familiarity","trust_building","fan_connection"],"archetypeHypotheses":["Girl Next Door"],"archetypeConfidence":14,"validationMode":"scenario_rank","reportHooks":["authenticity","private_fan_connection"]}}'::jsonb,
      1120
    ),
    (
      'v2_scenario_party_girl',
      'scenario_party_girl',
      'Rank the Party Girl scenarios you would be most comfortable turning into content.',
      NULL,
      'Positioning',
      'scenario_ranking',
      'archetype_validation',
      'persona_occupation',
      'Party Girl,Bimbo,Seductress',
      'includes_any',
      '[{"value":"nightlife_recap","label":"Nightlife recap with behind-the-scenes teasing"},{"value":"pre_party_live","label":"Confident livestream before going out"},{"value":"social_challenge","label":"High-energy social challenge content"},{"value":"party_bundle","label":"Private party-themed paid bundles"}]'::jsonb,
      '{"maxSelections":4,"evidence":{"dimensions":["archetype_validation","commercial_readiness"],"traits":["social_energy","visibility_comfort","monetisation_fit"],"archetypeHypotheses":["Party Girl"],"archetypeConfidence":14,"validationMode":"scenario_rank","reportHooks":["nightlife_visibility","party_monetisation_fit"]}}'::jsonb,
      1130
    ),
    (
      'v2_scenario_fitness',
      'scenario_fitness',
      'Rank the fitness-led content systems you could repeat weekly.',
      NULL,
      'Positioning',
      'scenario_ranking',
      'archetype_validation',
      'persona_occupation',
      'Fitness Goddess',
      'includes_any',
      '[{"value":"progress_clips","label":"Workout or body-progress clips"},{"value":"routine_updates","label":"Routine-based lifestyle updates"},{"value":"body_confidence","label":"Body-confidence check-ins"},{"value":"challenge_series","label":"Transformation or challenge content"}]'::jsonb,
      '{"maxSelections":4,"evidence":{"dimensions":["archetype_validation","content_engine"],"traits":["body_confidence","routine_discipline","visual_discipline"],"archetypeHypotheses":["Fitness Goddess"],"archetypeConfidence":14,"validationMode":"scenario_rank","reportHooks":["fitness_routine","visual_discipline"]}}'::jsonb,
      1140
    ),
    (
      'v2_scenario_dominatrix',
      'scenario_dominatrix',
      'Rank the Dominatrix scenarios that feel most aligned with your boundaries.',
      NULL,
      'Positioning',
      'scenario_ranking',
      'archetype_validation',
      'persona_occupation',
      'Dominatrix',
      'includes_any',
      '[{"value":"command_script","label":"Commanding scripted content"},{"value":"ritualised_dm","label":"Ritualised premium DM experience"},{"value":"boundary_menu","label":"Clear menu of rules and limits"},{"value":"power_roleplay","label":"Power-led roleplay sets"}]'::jsonb,
      '{"maxSelections":4,"evidence":{"dimensions":["archetype_validation","boundaries"],"traits":["visibility_comfort","risk_awareness","monetisation_fit"],"archetypeHypotheses":["Dominatrix"],"archetypeConfidence":14,"validationMode":"scenario_rank","reportHooks":["boundary_clarity","power_fantasy"]}}'::jsonb,
      1150
    ),
    (
      'v2_scenario_glamour_high_fashion',
      'scenario_glamour_high_fashion',
      'Rank the glamour or high-fashion scenarios that feel most natural.',
      NULL,
      'Positioning',
      'scenario_ranking',
      'archetype_validation',
      'persona_occupation',
      'Luxury Muse,Trophy Wife,Rich Girl,High-Class Escort Fantasy',
      'includes_any',
      '[{"value":"editorial_shoot","label":"Editorial-style shoot concepts"},{"value":"premium_lifestyle","label":"Premium lifestyle and taste content"},{"value":"exclusive_access","label":"Exclusive access and scarcity-led offers"},{"value":"beauty_fashion_series","label":"Beauty, styling, or outfit series"}]'::jsonb,
      '{"maxSelections":4,"evidence":{"dimensions":["archetype_validation","positioning"],"traits":["positioning_clarity","visual_discipline","monetisation_fit"],"archetypeHypotheses":["Luxury Muse"],"archetypeConfidence":14,"validationMode":"scenario_rank","reportHooks":["premium_visual_positioning","glamour_offer_fit"]}}'::jsonb,
      1160
    ),
    (
      'v2_scenario_gamer_girl',
      'scenario_gamer_girl',
      'Rank the Gamer Girl scenarios you could keep fun and consistent.',
      NULL,
      'Positioning',
      'scenario_ranking',
      'archetype_validation',
      'persona_occupation',
      'Gamer Girl,Cosplayer',
      'includes_any',
      '[{"value":"gameplay_flirt","label":"Gameplay with flirtatious commentary"},{"value":"cosplay_chat","label":"Cosplay chat and behind-the-scenes prep"},{"value":"fan_challenges","label":"Fan-voted challenges or dares"},{"value":"private_niche_chat","label":"Private niche chat with loyal fans"}]'::jsonb,
      '{"maxSelections":4,"evidence":{"dimensions":["archetype_validation","audience"],"traits":["authenticity","fan_connection","positioning_clarity"],"archetypeHypotheses":["Gamer Girl"],"archetypeConfidence":14,"validationMode":"scenario_rank","reportHooks":["niche_fan_connection","playful_content_engine"]}}'::jsonb,
      1170
    ),
    (
      'v2_scenario_submissive',
      'scenario_submissive',
      'Rank the Submissive scenarios that feel safe and commercially clear.',
      NULL,
      'Positioning',
      'scenario_ranking',
      'archetype_validation',
      'persona_occupation',
      'Submissive,Brat',
      'includes_any',
      '[{"value":"soft_power_exchange","label":"Soft power-exchange roleplay"},{"value":"clear_limits","label":"Boundary-led request menu"},{"value":"private_trust","label":"Private trust-building fan connection"},{"value":"scripted_tease","label":"Scripted tease with clear consent cues"}]'::jsonb,
      '{"maxSelections":4,"evidence":{"dimensions":["archetype_validation","boundaries"],"traits":["trust_building","fan_connection","risk_awareness"],"archetypeHypotheses":["Submissive"],"archetypeConfidence":14,"validationMode":"scenario_rank","reportHooks":["trust_and_boundaries","private_fan_connection"]}}'::jsonb,
      1180
    ),
    (
      'v2_audience_connection_style',
      'audience_connection_style',
      'What kind of fan connection would you prefer to be known for?',
      NULL,
      'Audience',
      'single_choice',
      'audience',
      NULL,
      NULL,
      'equals',
      '[{"value":"warm_regulars","label":"Warm regulars who feel familiar"},{"value":"high_spenders","label":"Selective high-spenders and premium access"},{"value":"broad_attention","label":"Broad attention and high-volume growth"},{"value":"niche_loyalists","label":"Niche loyalists who share my interests"}]'::jsonb,
      '{"required":true,"evidence":{"dimensions":["audience"],"traits":["fan_connection","monetisation_fit","trust_building"],"reportHooks":["audience_relationship_model"]}}'::jsonb,
      1210
    ),
    (
      'v2_content_repeatable_formats',
      'repeatable_content_formats',
      'Which content formats could you realistically repeat every week?',
      NULL,
      'Content Engine',
      'multi_choice',
      'content_engine',
      NULL,
      NULL,
      'equals',
      '[{"value":"storytime","label":"Storytime or confessionals"},{"value":"routine","label":"Routine/lifestyle updates"},{"value":"shoot_sets","label":"Photo or video shoot sets"},{"value":"live_chat","label":"Live chat or fan interaction"},{"value":"roleplay","label":"Roleplay or character scenes"},{"value":"progress_tracking","label":"Progress tracking or challenge content"}]'::jsonb,
      '{"maxSelections":4,"evidence":{"dimensions":["content_engine"],"traits":["routine_discipline","positioning_clarity","fan_connection"],"reportHooks":["repeatable_content_engine"]}}'::jsonb,
      1310
    ),
    (
      'v2_vertical_fitness_validation',
      'vertical_fitness_validation',
      'You selected fitness or body content. Which vertical feels most sustainable?',
      NULL,
      'Content Engine',
      'scenario_ranking',
      'vertical_validation',
      'niche_interests',
      'Fitness/Muscle',
      'includes_any',
      '[{"value":"fitness_journey","label":"Fitness Journey"},{"value":"body_confidence","label":"Body Confidence Content"},{"value":"routine_lifestyle","label":"Routine-led lifestyle"},{"value":"challenge_progress","label":"Challenge/progress series"}]'::jsonb,
      '{"maxSelections":3,"evidence":{"dimensions":["content_engine","archetype_validation"],"traits":["body_confidence","routine_discipline","visual_discipline"],"archetypeHypotheses":["Fitness Goddess"],"archetypeConfidence":10,"validationMode":"vertical_rank","reportHooks":["fitness_vertical_fit"]}}'::jsonb,
      1320
    ),
    (
      'v2_vertical_roleplay_validation',
      'vertical_roleplay_validation',
      'You selected roleplay or dynamic-led content. Which direction fits best?',
      NULL,
      'Content Engine',
      'scenario_ranking',
      'vertical_validation',
      'niche_interests',
      'Roleplay,Daddy dynamic',
      'includes_any',
      '[{"value":"character_sets","label":"Character-led sets"},{"value":"private_requests","label":"Private custom requests"},{"value":"scripted_scenes","label":"Scripted scenes with clear limits"},{"value":"recurring_dynamic","label":"Recurring fan dynamic or ritual"}]'::jsonb,
      '{"maxSelections":3,"evidence":{"dimensions":["content_engine","commercial_readiness"],"traits":["positioning_clarity","risk_awareness","monetisation_fit"],"archetypeHypotheses":["Dominatrix","Submissive"],"archetypeConfidence":10,"validationMode":"vertical_rank","reportHooks":["roleplay_vertical_fit","boundary_clarity"]}}'::jsonb,
      1330
    ),
    (
      'v2_commercial_offer_comfort',
      'commercial_offer_comfort',
      'What kind of monetisation path feels most realistic first?',
      NULL,
      'Commercial Readiness',
      'single_choice',
      'commercial_readiness',
      NULL,
      NULL,
      'equals',
      '[{"value":"subscriptions_first","label":"Subscriptions first"},{"value":"premium_bundles","label":"Premium bundles or PPV"},{"value":"custom_requests","label":"Custom requests"},{"value":"dm_relationships","label":"DM relationships and retention"},{"value":"not_sure","label":"Not sure yet"}]'::jsonb,
      '{"required":true,"evidence":{"dimensions":["commercial_readiness"],"traits":["monetisation_fit","risk_awareness"],"reportHooks":["monetisation_pathway"]}}'::jsonb,
      1410
    ),
    (
      'v2_commercial_whales_followup',
      'commercial_whales_followup',
      'Because you chose high-spending fans, what premium path feels strongest?',
      NULL,
      'Commercial Readiness',
      'scenario_ranking',
      'commercial_readiness',
      'audience_target',
      'whales',
      'equals',
      '[{"value":"exclusive_access","label":"Exclusive access and scarcity"},{"value":"high_touch_dm","label":"High-touch DM relationship"},{"value":"premium_customs","label":"Premium custom content"},{"value":"luxury_positioning","label":"Luxury or polished positioning"}]'::jsonb,
      '{"maxSelections":3,"evidence":{"dimensions":["commercial_readiness"],"traits":["monetisation_fit","fan_connection","positioning_clarity"],"archetypeConfidence":8,"validationMode":"commercial_followup","reportHooks":["premium_pathway","whale_audience_fit"]}}'::jsonb,
      1420
    ),
    (
      'v2_commercial_masses_followup',
      'commercial_masses_followup',
      'Because you chose mass audience growth, what volume path feels strongest?',
      NULL,
      'Commercial Readiness',
      'scenario_ranking',
      'commercial_readiness',
      'audience_target',
      'masses',
      'equals',
      '[{"value":"short_form_growth","label":"Short-form discovery"},{"value":"low_friction_offer","label":"Low-friction entry offer"},{"value":"fan_polling","label":"Fan polling and recurring engagement"},{"value":"bundle_upsells","label":"Small bundle upsells"}]'::jsonb,
      '{"maxSelections":3,"evidence":{"dimensions":["commercial_readiness","growth_potential"],"traits":["monetisation_fit","social_energy","routine_discipline"],"archetypeConfidence":8,"validationMode":"commercial_followup","reportHooks":["volume_pathway","mass_audience_fit"]}}'::jsonb,
      1430
    ),
    (
      'v2_commercial_explicit_followup',
      'commercial_explicit_followup',
      'Given your content boundary selection, which paid-content structure feels safest?',
      NULL,
      'Commercial Readiness',
      'scenario_ranking',
      'commercial_readiness',
      'content_comfort',
      'topless,full_nude,fetish',
      'includes_any',
      '[{"value":"clear_menu","label":"Clear menu of offers and limits"},{"value":"tiered_tease","label":"Tiered tease-to-explicit pathway"},{"value":"custom_screening","label":"Screened custom requests"},{"value":"fetish_lane","label":"Specific fetish or niche lane"}]'::jsonb,
      '{"maxSelections":3,"evidence":{"dimensions":["commercial_readiness","boundaries"],"traits":["risk_awareness","monetisation_fit","positioning_clarity"],"archetypeConfidence":8,"validationMode":"commercial_followup","reportHooks":["paid_boundary_structure"]}}'::jsonb,
      1440
    ),
    (
      'v2_growth_support_style',
      'growth_support_style',
      'What kind of support would most improve your next stage?',
      NULL,
      'Growth Potential',
      'multi_choice',
      'growth_potential',
      NULL,
      NULL,
      'equals',
      '[{"value":"content_direction","label":"Content direction"},{"value":"posting_system","label":"Posting system and consistency"},{"value":"pricing_offers","label":"Pricing and offers"},{"value":"fan_retention","label":"Fan retention and DMs"},{"value":"confidence_coaching","label":"Confidence and boundaries"},{"value":"management_support","label":"Management support"}]'::jsonb,
      '{"maxSelections":3,"evidence":{"dimensions":["growth_potential"],"traits":["coachability","routine_discipline","monetisation_fit"],"reportHooks":["recommended_services","coachability"]}}'::jsonb,
      1510
    ),
    (
      'v2_future_90_day_focus',
      'future_90_day_focus',
      'If the next 90 days went well, what would be most different?',
      NULL,
      'Future Vision',
      'single_choice',
      'future_vision',
      NULL,
      NULL,
      'equals',
      '[{"value":"clearer_identity","label":"I would understand my creator identity clearly"},{"value":"consistent_output","label":"I would be posting consistently"},{"value":"better_income","label":"I would have a clearer income pathway"},{"value":"stronger_fans","label":"I would have stronger fan relationships"},{"value":"agency_ready","label":"I would know whether agency support fits"}]'::jsonb,
      '{"required":true,"evidence":{"dimensions":["future_vision"],"traits":["coachability","positioning_clarity"],"reportHooks":["ninety_day_goal","future_direction"]}}'::jsonb,
      1610
    )
),
upsert_questions AS (
  INSERT INTO public.creator_question_bank (
    question_key,
    response_key,
    question_text,
    help_text,
    section,
    question_type,
    scoring_dimension,
    parent_question_key,
    show_when_value,
    show_when_operator,
    options,
    config,
    is_active
  )
  SELECT
    question_key,
    response_key,
    question_text,
    help_text,
    section,
    question_type,
    scoring_dimension,
    parent_question_key,
    show_when_value,
    show_when_operator,
    options,
    config,
    true
  FROM question_seed
  ON CONFLICT (question_key) DO UPDATE SET
    response_key = EXCLUDED.response_key,
    question_text = EXCLUDED.question_text,
    help_text = EXCLUDED.help_text,
    section = EXCLUDED.section,
    question_type = EXCLUDED.question_type,
    scoring_dimension = EXCLUDED.scoring_dimension,
    parent_question_key = EXCLUDED.parent_question_key,
    show_when_value = EXCLUDED.show_when_value,
    show_when_operator = EXCLUDED.show_when_operator,
    options = EXCLUDED.options,
    config = EXCLUDED.config,
    is_active = true
  RETURNING id, question_key
)
INSERT INTO public.creator_assessment_template_items (
  template_id,
  item_type,
  question_id,
  title,
  description,
  is_included,
  sort_order
)
SELECT
  dt.id,
  'question',
  q.id,
  NULL,
  NULL,
  true,
  qs.sort_order
FROM default_template dt
JOIN question_seed qs ON true
JOIN public.creator_question_bank q ON q.question_key = qs.question_key
WHERE NOT EXISTS (
  SELECT 1
  FROM public.creator_assessment_template_items existing
  WHERE existing.template_id = dt.id
    AND existing.item_type = 'question'
    AND existing.question_id = q.id
);
