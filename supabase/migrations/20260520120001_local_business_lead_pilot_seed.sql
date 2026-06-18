-- Local Business Lead Pilot — 25-lead seed (Helensville / North West Auckland)
--
-- Idempotent: ON CONFLICT (slug) DO NOTHING. Re-running this migration does
-- not duplicate leads. The AFTER INSERT trigger on local_business_leads will
-- emit local_business.discovered events ONLY for rows actually inserted.
--
-- See docs/architecture/local-business-lead-pilot-v1.md.

begin;

insert into public.local_business_leads (
  business_name,
  slug,
  source,
  status,
  region,
  country,
  notes
)
values
  ('Swale Earthmovers Ltd',                              'swale-earthmovers-ltd',                              'manual_pilot', 'discovered', 'Auckland', 'NZ', 'Initial 25-lead pilot for Helensville / North West Auckland digital trust leakage workflow.'),
  ('Wire All Electrical Services Ltd',                   'wire-all-electrical-services-ltd',                   'manual_pilot', 'discovered', 'Auckland', 'NZ', 'Initial 25-lead pilot for Helensville / North West Auckland digital trust leakage workflow.'),
  ('Helensville Drainage',                               'helensville-drainage',                               'manual_pilot', 'discovered', 'Auckland', 'NZ', 'Initial 25-lead pilot for Helensville / North West Auckland digital trust leakage workflow.'),
  ('Hawky Haulage 2008 Ltd',                             'hawky-haulage-2008-ltd',                             'manual_pilot', 'discovered', 'Auckland', 'NZ', 'Initial 25-lead pilot for Helensville / North West Auckland digital trust leakage workflow.'),
  ('Volt Solutions',                                     'volt-solutions',                                     'manual_pilot', 'discovered', 'Auckland', 'NZ', 'Initial 25-lead pilot for Helensville / North West Auckland digital trust leakage workflow.'),
  ('Coldicutt Blackman',                                 'coldicutt-blackman',                                 'manual_pilot', 'discovered', 'Auckland', 'NZ', 'Initial 25-lead pilot for Helensville / North West Auckland digital trust leakage workflow.'),
  ('Glass Lab',                                          'glass-lab',                                          'manual_pilot', 'discovered', 'Auckland', 'NZ', 'Initial 25-lead pilot for Helensville / North West Auckland digital trust leakage workflow.'),
  ('River Valley Meats',                                 'river-valley-meats',                                 'manual_pilot', 'discovered', 'Auckland', 'NZ', 'Initial 25-lead pilot for Helensville / North West Auckland digital trust leakage workflow.'),
  ('The Real Bread Project',                             'the-real-bread-project',                             'manual_pilot', 'discovered', 'Auckland', 'NZ', 'Initial 25-lead pilot for Helensville / North West Auckland digital trust leakage workflow.'),
  ('Helensville Zero Waste',                             'helensville-zero-waste',                             'manual_pilot', 'discovered', 'Auckland', 'NZ', 'Initial 25-lead pilot for Helensville / North West Auckland digital trust leakage workflow.'),
  ('Sobhna''s',                                          'sobhnas',                                            'manual_pilot', 'discovered', 'Auckland', 'NZ', 'Initial 25-lead pilot for Helensville / North West Auckland digital trust leakage workflow.'),
  ('Fifth Hair Studio',                                  'fifth-hair-studio',                                  'manual_pilot', 'discovered', 'Auckland', 'NZ', 'Initial 25-lead pilot for Helensville / North West Auckland digital trust leakage workflow.'),
  ('Chanelle Jade Hair Studio',                          'chanelle-jade-hair-studio',                          'manual_pilot', 'discovered', 'Auckland', 'NZ', 'Initial 25-lead pilot for Helensville / North West Auckland digital trust leakage workflow.'),
  ('WashWorx NZ Ltd',                                    'washworx-nz-ltd',                                    'manual_pilot', 'discovered', 'Auckland', 'NZ', 'Initial 25-lead pilot for Helensville / North West Auckland digital trust leakage workflow.'),
  ('Roaming Flamingo Food Truck',                        'roaming-flamingo-food-truck',                        'manual_pilot', 'discovered', 'Auckland', 'NZ', 'Initial 25-lead pilot for Helensville / North West Auckland digital trust leakage workflow.'),
  ('Hana''s Group Fitness',                              'hanas-group-fitness',                                'manual_pilot', 'discovered', 'Auckland', 'NZ', 'Initial 25-lead pilot for Helensville / North West Auckland digital trust leakage workflow.'),
  ('South Kaipara Good Food / Kai Hub',                  'south-kaipara-good-food-kai-hub',                    'manual_pilot', 'discovered', 'Auckland', 'NZ', 'Initial 25-lead pilot for Helensville / North West Auckland digital trust leakage workflow.'),
  ('K & J Home Care Services',                           'k-and-j-home-care-services',                         'manual_pilot', 'discovered', 'Auckland', 'NZ', 'Initial 25-lead pilot for Helensville / North West Auckland digital trust leakage workflow.'),
  ('Harcourts Helensville - The Difference Limited',     'harcourts-helensville-the-difference-limited',       'manual_pilot', 'discovered', 'Auckland', 'NZ', 'Initial 25-lead pilot for Helensville / North West Auckland digital trust leakage workflow.'),
  ('Parkview Helensville Auckland NZ',                   'parkview-helensville-auckland-nz',                   'manual_pilot', 'discovered', 'Auckland', 'NZ', 'Initial 25-lead pilot for Helensville / North West Auckland digital trust leakage workflow.'),
  ('Local Business Candidate 21',                        'local-business-candidate-21',                        'manual_pilot', 'discovered', 'Auckland', 'NZ', 'Initial 25-lead pilot for Helensville / North West Auckland digital trust leakage workflow. Placeholder pending manual selection.'),
  ('Local Business Candidate 22',                        'local-business-candidate-22',                        'manual_pilot', 'discovered', 'Auckland', 'NZ', 'Initial 25-lead pilot for Helensville / North West Auckland digital trust leakage workflow. Placeholder pending manual selection.'),
  ('Local Business Candidate 23',                        'local-business-candidate-23',                        'manual_pilot', 'discovered', 'Auckland', 'NZ', 'Initial 25-lead pilot for Helensville / North West Auckland digital trust leakage workflow. Placeholder pending manual selection.'),
  ('Local Business Candidate 24',                        'local-business-candidate-24',                        'manual_pilot', 'discovered', 'Auckland', 'NZ', 'Initial 25-lead pilot for Helensville / North West Auckland digital trust leakage workflow. Placeholder pending manual selection.'),
  ('Local Business Candidate 25',                        'local-business-candidate-25',                        'manual_pilot', 'discovered', 'Auckland', 'NZ', 'Initial 25-lead pilot for Helensville / North West Auckland digital trust leakage workflow. Placeholder pending manual selection.')
on conflict (slug) do nothing;

commit;
