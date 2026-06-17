import { supabase } from './supabase';
import type {
  CreatorProfile,
  CreatorAssessment,
  CreatorReport,
  CreatorNote,
  CreatorStatusEvent,
  AssessmentResponses,
  ReportData,
} from '@/types/creator';
import { scoreAssessment, generateReportSlug } from './scoring';

// ── Assessment Submission (public) ──

export async function submitAssessment(responses: AssessmentResponses): Promise<{
  profile: CreatorProfile;
  assessment: CreatorAssessment;
  report: CreatorReport;
}> {
  // 1. Score the assessment
  const result = scoreAssessment(responses);
  const slug = generateReportSlug(responses.full_name);

  // 2. Create creator profile
  const { data: profile, error: profileErr } = await supabase
    .from('creator_profiles')
    .insert({
      full_name: responses.full_name,
      email: responses.email,
      country: responses.country,
      creator_stage: 'prospect',
      status: 'prospect',
      archetype: result.archetype,
      creator_dna_score: result.scores.creator_dna,
      brand_clarity_score: result.scores.brand_clarity,
      monetisation_score: result.scores.monetisation,
      consistency_score: result.scores.consistency,
      agency_opportunity_score: result.scores.agency_opportunity,
      management_readiness: result.management_readiness,
      audience_strategy: responses.audience_target,
      recommended_pricing_model: result.pricing_strategy,
      top_vertical_1: result.top_verticals[0]?.name ?? null,
      top_vertical_2: result.top_verticals[1]?.name ?? null,
      top_vertical_3: result.top_verticals[2]?.name ?? null,
    })
    .select()
    .single();

  if (profileErr) throw new Error(`Failed to create profile: ${profileErr.message}`);
  const profileId = profile.id;

  // 3. Create assessment
  const { data: assessment, error: assessmentErr } = await supabase
    .from('creator_assessments')
    .insert({
      creator_profile_id: profileId,
      responses,
      creator_dna_score: result.scores.creator_dna,
      brand_clarity_score: result.scores.brand_clarity,
      monetisation_score: result.scores.monetisation,
      consistency_score: result.scores.consistency,
      agency_opportunity_score: result.scores.agency_opportunity,
    })
    .select()
    .single();

  if (assessmentErr) throw new Error(`Failed to save assessment: ${assessmentErr.message}`);

  // 4. Create report
  const reportData: ReportData = {
    archetype: result.archetype,
    archetype_description: result.archetype_description,
    archetype_strengths: result.archetype_strengths,
    archetype_risks: result.archetype_risks,
    archetype_growth: result.archetype_growth,
    scores: result.scores,
    top_verticals: result.top_verticals,
    pricing_strategy: result.pricing_strategy,
    winning_10_framework: result.winning_10_framework,
    growth_strategy: result.growth_strategy,
    tech_stack: result.tech_stack,
    management_readiness: result.management_readiness,
    day_90_plan: result.day_90_plan,
  };

  const { data: report, error: reportErr } = await supabase
    .from('creator_reports')
    .insert({
      creator_profile_id: profileId,
      report_slug: slug,
      report_json: reportData,
      version: '1.0',
    })
    .select()
    .single();

  if (reportErr) throw new Error(`Failed to save report: ${reportErr.message}`);

  // 5. Link latest assessment & report to profile
  await supabase
    .from('creator_profiles')
    .update({
      latest_assessment_id: assessment.id,
      latest_report_id: report.id,
    })
    .eq('id', profileId);

  // 6. Create assessment_completed event
  await supabase.from('creator_status_events').insert({
    creator_profile_id: profileId,
    event_type: 'assessment_completed',
    details: { assessment_id: assessment.id, report_slug: slug },
  });

  return {
    profile: { ...profile, latest_assessment_id: assessment.id, latest_report_id: report.id },
    assessment,
    report,
  };
}

// ── Public Reads ──

export async function getCreatorProfile(profileId: string): Promise<CreatorProfile | null> {
  const { data } = await supabase.from('creator_profiles').select().eq('id', profileId).single();
  return data as CreatorProfile | null;
}

export async function getReportBySlug(slug: string): Promise<CreatorReport | null> {
  const { data } = await supabase
    .from('creator_reports')
    .select()
    .eq('report_slug', slug)
    .single();
  return data as CreatorReport | null;
}

// ── Authenticated Cockpit API ──

export async function getAllCreatorProfiles(): Promise<CreatorProfile[]> {
  const { data } = await supabase
    .from('creator_profiles')
    .select('*')
    .order('agency_opportunity_score', { ascending: false });
  return (data ?? []) as CreatorProfile[];
}

export async function getAssessmentsForProfile(profileId: string): Promise<CreatorAssessment[]> {
  const { data } = await supabase
    .from('creator_assessments')
    .select()
    .eq('creator_profile_id', profileId)
    .order('created_at', { ascending: false });
  return (data ?? []) as CreatorAssessment[];
}

export async function getReportsForProfile(profileId: string): Promise<CreatorReport[]> {
  const { data } = await supabase
    .from('creator_reports')
    .select()
    .eq('creator_profile_id', profileId)
    .order('created_at', { ascending: false });
  return (data ?? []) as CreatorReport[];
}

export async function getNotesForProfile(profileId: string): Promise<CreatorNote[]> {
  const { data } = await supabase
    .from('creator_notes')
    .select()
    .eq('creator_profile_id', profileId)
    .order('created_at', { ascending: false });
  return (data ?? []) as CreatorNote[];
}

export async function getStatusEventsForProfile(profileId: string): Promise<CreatorStatusEvent[]> {
  const { data } = await supabase
    .from('creator_status_events')
    .select()
    .eq('creator_profile_id', profileId)
    .order('created_at', { ascending: false });
  return (data ?? []) as CreatorStatusEvent[];
}

export async function updateCreatorStatus(
  profileId: string,
  status: string,
  eventType: string,
  details?: Record<string, unknown>
): Promise<void> {
  await supabase.from('creator_profiles').update({ status }).eq('id', profileId);
  await supabase.from('creator_status_events').insert({
    creator_profile_id: profileId,
    event_type: eventType,
    details: details ?? {},
  });
}

export async function addCreatorNote(profileId: string, note: string): Promise<CreatorNote | null> {
  const { data } = await supabase
    .from('creator_notes')
    .insert({ creator_profile_id: profileId, note })
    .select()
    .single();
  return data as CreatorNote | null;
}

// ── Dashboard Metrics ──

export interface DashboardMetrics {
  totalProfiles: number;
  assessmentsCompleted: number;
  qualifiedCreators: number;
  activeCreators: number;
  avgAgencyScore: number;
  scaleCandidates: number;
  conversionRate: number;
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const { data: profiles } = await supabase.from('creator_profiles').select('*');
  const p = (profiles ?? []) as CreatorProfile[];

  const totalProfiles = p.length;
  const qualifiedCreators = p.filter(x => x.status === 'qualified' || x.status === 'interviewed' || x.status === 'accepted' || x.status === 'onboarding' || x.status === 'active').length;
  const activeCreators = p.filter(x => x.status === 'active').length;
  const scaleCandidates = p.filter(x => x.management_readiness === 'Scale Candidate').length;
  const avgAgencyScore = totalProfiles > 0
    ? Math.round(p.reduce((sum, x) => sum + (x.agency_opportunity_score ?? 0), 0) / totalProfiles)
    : 0;

  const { count: assessmentCount } = await supabase
    .from('creator_assessments')
    .select('*', { count: 'exact', head: true });

  const conversionRate = totalProfiles > 0
    ? Math.round(((activeCreators + qualifiedCreators) / totalProfiles) * 100)
    : 0;

  return {
    totalProfiles,
    assessmentsCompleted: assessmentCount ?? 0,
    qualifiedCreators,
    activeCreators,
    avgAgencyScore,
    scaleCandidates,
    conversionRate,
  };
}
