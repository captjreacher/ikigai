import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  getCreatorProfile,
  getAssessmentsForProfile,
  getCreatorDnaProfilesForProfile,
  getReportsForProfile,
  getStatusEventsForProfile,
  getNotesForProfile,
  addCreatorNote,
} from '@/lib/creators-api';
import { createCreatorIntelligenceResult, buildReportFromCreatorDna } from '@/lib/creator-intelligence';
import { scoreAssessment } from '@/lib/scoring';
import type {
  CreatorProfile,
  CreatorAssessment,
  CreatorDnaProfile,
  CreatorReport,
  CreatorNote,
  CreatorStatusEvent,
  CreatorAssessmentQuestion,
  CreatorIntelligenceResult,
  AssessmentEvidence,
  TraitWeight,
  AssessmentResponses,
  ReportTier,
  ReportData,
} from '@/types/creator';

/* ── helpers ── */

function clamp(v: number, lo = 0, hi = 100) { return Math.max(lo, Math.min(hi, Math.round(v))); }

function optionLabel(o: unknown): string {
  if (typeof o === 'string') return o;
  if (o && typeof o === 'object' && 'label' in o) return String((o as { label: string }).label);
  if (o && typeof o === 'object' && 'value' in o) return String((o as { value: string }).value);
  return String(o);
}

function formatAnswer(question: CreatorAssessmentQuestion, value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
    return <span className="text-gray-400 italic">No answer</span>;
  }

  const qt = question.question_type;
  if (qt === 'short_text' || qt === 'long_text' || qt === 'textarea') {
    return <p className="whitespace-pre-wrap text-sm text-gray-800">{String(value)}</p>;
  }
  if (qt === 'single_choice') {
    const label = optionLabel(value);
    const match = (question.options as unknown[]).find(o => optionLabel(o) === label || (typeof o === 'object' && o && 'value' in o && (o as { value: string }).value === String(value)));
    return <span className="text-sm text-gray-800">{match ? optionLabel(match) : label}</span>;
  }
  if (qt === 'multi_choice') {
    const vals: string[] = Array.isArray(value) ? value.map(String) : [String(value)];
    return (
      <ul className="list-disc list-inside space-y-1">
        {vals.map((v, i) => {
          const match = (question.options as unknown[]).find(o => optionLabel(o) === v || (typeof o === 'object' && o && 'value' in o && (o as { value: string }).value === v));
          return <li key={i} className="text-sm text-gray-800">{match ? optionLabel(match) : v}</li>;
        })}
      </ul>
    );
  }
  if (qt === 'boolean') {
    return <span className="text-sm text-gray-800">{value === true ? 'Yes' : value === false ? 'No' : String(value)}</span>;
  }
  if (qt === 'scale') {
    const n = Number(value);
    return (
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 rounded-full bg-surface-3">
          <div className="h-2 rounded-full bg-accent" style={{ width: `${clamp(n, 1, 10) * 10}%` }} />
        </div>
        <span className="text-sm font-semibold text-gray-800">{n}/10</span>
      </div>
    );
  }
  if (qt === 'scenario_ranking') {
    const items: string[] = Array.isArray(value) ? value.map(String) : [String(value)];
    return (
      <ol className="list-decimal list-inside space-y-1">
        {items.map((item, i) => <li key={i} className="text-sm text-gray-800">{item}</li>)}
      </ol>
    );
  }
  return <span className="text-sm text-gray-800">{String(value)}</span>;
}

function formatMetadata(question: CreatorAssessmentQuestion): string {
  const parts: string[] = [];
  if (question.scoring_dimension) parts.push(`Dimension: ${question.scoring_dimension}`);
  if (question.response_key) parts.push(`Key: ${question.response_key}`);
  return parts.join(' · ');
}

/* ── sub-components ── */

function ConfidenceBar({ value, label }: { value: number; label?: string }) {
  const pct = clamp(value);
  return (
    <div className="flex items-center gap-2">
      <div className="h-2.5 flex-1 rounded-full bg-surface-3">
        <div
          className={`h-2.5 rounded-full transition-all ${pct >= 70 ? 'bg-success' : pct >= 50 ? 'bg-warn' : 'bg-pink'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-gray-600 w-10 text-right">{pct}%</span>
      {label && <span className="text-xs text-gray-500">{label}</span>}
    </div>
  );
}

function EvidenceCard({ evidence }: { evidence: AssessmentEvidence }) {
  return (
    <div className="bg-surface-2 rounded-lg p-3 border-l-4" style={{ borderLeftColor: evidence.polarity === 'positive' ? 'var(--color-success,#22c55e)' : evidence.polarity === 'negative' ? 'var(--color-pink,#ec4899)' : 'var(--color-gray-400)' }}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{evidence.dimension.replace(/_/g, ' ')}</span>
        <span className="text-xs text-gray-400">{evidence.strength} pts</span>
      </div>
      <p className="text-sm text-gray-700 mb-2">{String(evidence.value).slice(0, 200)}</p>
      <div className="flex flex-wrap gap-1">
        {evidence.tags.map(tag => (
          <span key={tag} className="px-1.5 py-0.5 rounded text-[10px] bg-surface-3 text-gray-600">{tag}</span>
        ))}
      </div>
    </div>
  );
}

/* ── main page ── */

type TabId = 'overview' | 'responses' | 'evidence' | 'traits' | 'archetypes' | 'dna' | 'report' | 'agency' | 'timeline';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'responses', label: 'Raw Responses' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'traits', label: 'Trait Engine' },
  { id: 'archetypes', label: 'Archetype Engine' },
  { id: 'dna', label: 'Creator DNA' },
  { id: 'report', label: 'Report Preview' },
  { id: 'agency', label: 'Agency Review' },
  { id: 'timeline', label: 'Timeline' },
];

export function CreatorIntelligence() {
  const { profileId } = useParams<{ profileId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [tab, setTab] = useState<TabId>('overview');
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [assessments, setAssessments] = useState<CreatorAssessment[]>([]);
  const [dnaProfiles, setDnaProfiles] = useState<CreatorDnaProfile[]>([]);
  const [reports, setReports] = useState<CreatorReport[]>([]);
  const [events, setEvents] = useState<CreatorStatusEvent[]>([]);
  const [notes, setNotes] = useState<CreatorNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Assessment selection
  const [selectedAssessmentId, setSelectedAssessmentId] = useState(searchParams.get('assessmentId') ?? '');

  // Agency note
  const [noteText, setNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);

  // Report tier for preview
  const [previewTier, setPreviewTier] = useState<ReportTier | null>(null);

  // Expanded traits / archetypes
  const [expandedTrait, setExpandedTrait] = useState<string | null>(null);
  const [selectedArchetype, setSelectedArchetype] = useState<string | null>(null);
  const [expandedDnaGroup, setExpandedDnaGroup] = useState<string | null>(null);

  useEffect(() => {
    if (!profileId) return;
    Promise.all([
      getCreatorProfile(profileId),
      getAssessmentsForProfile(profileId),
      getCreatorDnaProfilesForProfile(profileId),
      getReportsForProfile(profileId),
      getStatusEventsForProfile(profileId),
      getNotesForProfile(profileId),
    ])
      .then(([p, a, d, r, e, n]) => {
        setProfile(p);
        setAssessments(a);
        setDnaProfiles(d);
        setReports(r);
        setEvents(e);
        setNotes(n);
        if (!selectedAssessmentId && a.length > 0) {
          setSelectedAssessmentId(a[0].id);
        }
      })
      .catch(() => setError('Unable to load creator intelligence data.'))
      .finally(() => setLoading(false));
  }, [profileId]);

  const selectedAssessment = useMemo(
    () => assessments.find(a => a.id === selectedAssessmentId) ?? null,
    [assessments, selectedAssessmentId]
  );

  // Recompute intelligence client-side
  const intelligence = useMemo<CreatorIntelligenceResult | null>(() => {
    if (!selectedAssessment?.responses) return null;
    const questions: CreatorAssessmentQuestion[] = selectedAssessment.assessment_snapshot?.question_snapshot ?? [];
    try {
      return createCreatorIntelligenceResult({
        creatorProfileId: profileId!,
        assessmentId: selectedAssessment.id,
        responses: selectedAssessment.responses,
        questions,
        reportTier: 'free',
      });
    } catch {
      return null;
    }
  }, [selectedAssessment, profileId]);

  // Recompute report at a different tier
  const tierReport = useMemo<ReportData | null>(() => {
    if (!intelligence || !previewTier) return null;
    try {
      const legacy = scoreAssessment(selectedAssessment!.responses);
      return buildReportFromCreatorDna({
        legacy,
        dnaProfile: intelligence.creator_dna,
        evidence: intelligence.evidence,
        traits: intelligence.traits,
        confidence: intelligence.confidence,
        reportTier: previewTier,
      });
    } catch {
      return null;
    }
  }, [intelligence, previewTier, selectedAssessment]);

  const storedReport = useMemo(
    () => reports.find(r => r.id === selectedAssessment?.id || r.creator_profile_id === profileId) ?? reports[0] ?? null,
    [reports, selectedAssessment, profileId]
  );

  const displayedReport: ReportData | null = tierReport ?? (storedReport?.report_json as ReportData | null) ?? null;

  const addNote = useCallback(async () => {
    if (!profileId || !noteText.trim()) return;
    setNoteSaving(true);
    try {
      const note = await addCreatorNote(profileId, noteText.trim());
      if (note) {
        setNotes(prev => [note, ...prev]);
        setNoteText('');
      }
    } finally {
      setNoteSaving(false);
    }
  }, [profileId, noteText]);

  // ── render states ──

  if (loading) return <div className="animate-pulse p-8 text-gray-500">Loading Creator Intelligence...</div>;
  if (error) return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  if (!profile) return <div className="p-4 text-sm text-gray-600">Creator not found.</div>;

  const templateName = selectedAssessment?.assessment_snapshot?.template_name ?? selectedAssessment?.template_slug ?? 'Default';

  // ── tab renderers ──

  function renderOverview() {
    const dna = dnaProfiles[0];
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Creator</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              ['Name', profile.full_name],
              ['Email', profile.email ?? '-'],
              ['Status', profile.status],
              ['Archetype', profile.archetype ?? '-'],
            ].map(([l, v]) => (
              <div key={l} className="bg-surface-2 rounded-lg p-3">
                <div className="text-xs text-gray-500">{l}</div>
                <div className="text-sm font-semibold text-gray-900 mt-0.5">{v}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Assessment</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              ['Date', selectedAssessment ? new Date(selectedAssessment.created_at).toLocaleString() : '-'],
              ['Template', templateName],
              ['Invite Code', selectedAssessment?.invite_code ?? '-'],
              ['Report Tier', storedReport?.report_tier ?? 'free'],
              ['Assessment Version', storedReport?.version ?? '1.0'],
              ['DNA Confidence', dna ? `${dna.confidence}%` : '-'],
            ].map(([l, v]) => (
              <div key={l} className="bg-surface-2 rounded-lg p-3">
                <div className="text-xs text-gray-500">{l}</div>
                <div className="text-sm font-semibold text-gray-900 mt-0.5">{v}</div>
              </div>
            ))}
          </div>
        </div>
        {/* Scores */}
        <div className="md:col-span-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Overall Scores</h3>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {[
              ['Creator DNA', profile.creator_dna_score],
              ['Brand Clarity', profile.brand_clarity_score],
              ['Monetisation', profile.monetisation_score],
              ['Consistency', profile.consistency_score],
              ['Agency Opp.', profile.agency_opportunity_score],
            ].map(([l, s]) => (
              <div key={l} className="bg-surface-2 rounded-lg p-3 text-center">
                <div className={`text-xl font-bold ${(s ?? 0) >= 60 ? 'text-success' : (s ?? 0) >= 40 ? 'text-warn' : 'text-pink'}`}>{s ?? '-'}</div>
                <div className="text-[10px] text-gray-500 mt-1 leading-tight">{l}</div>
              </div>
            ))}
          </div>
        </div>
        {/* Report status */}
        <div className="md:col-span-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">Report Status</h3>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-surface-3 px-3 py-1 text-xs font-semibold text-gray-700">Stored: {storedReport ? storedReport.report_tier ?? 'free' : 'none'}</span>
            {storedReport?.premium_report_available && <span className="rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">Premium available</span>}
            {storedReport?.premium_report_generated && <span className="rounded-full bg-success/15 px-3 py-1 text-xs font-semibold text-success">Premium generated</span>}
            {dna && <span className="rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">DNA: {dna.confidence}%</span>}
          </div>
        </div>
      </div>
    );
  }

  function renderRawResponses() {
    const questions = selectedAssessment?.assessment_snapshot?.question_snapshot ?? [];
    const responses: AssessmentResponses = selectedAssessment?.responses ?? ({} as AssessmentResponses);
    const sections = new Map<string, CreatorAssessmentQuestion[]>();
    for (const q of questions) {
      const s = q.section || 'Other';
      if (!sections.has(s)) sections.set(s, []);
      sections.get(s)!.push(q);
    }

    if (questions.length === 0) {
      return <p className="text-sm text-gray-600">No question snapshot stored with this assessment.</p>;
    }

    return (
      <div className="space-y-8">
        {Array.from(sections.entries()).map(([section, qs]) => (
          <div key={section}>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-4 pb-2 border-b border-gray-200">{section}</h3>
            <div className="space-y-5">
              {qs.map(q => {
                const value = responses[q.response_key];
                return (
                  <div key={q.id} className="bg-surface-2 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{q.question_text}</p>
                        {q.help_text && <p className="text-xs text-gray-500 mt-1">{q.help_text}</p>}
                      </div>
                      <span className="shrink-0 rounded-full bg-surface-3 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-600">{q.question_type.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="mt-2">{formatAnswer(q, value)}</div>
                    <div className="mt-2 text-[10px] text-gray-400">{formatMetadata(q)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderEvidence() {
    const evidence = intelligence?.evidence ?? [];
    if (evidence.length === 0) return <p className="text-sm text-gray-600">No evidence signals extracted.</p>;

    const grouped = new Map<string, AssessmentEvidence[]>();
    for (const e of evidence) {
      const key = e.dimension.replace(/_/g, ' ');
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(e);
    }

    return (
      <div className="space-y-6">
        {Array.from(grouped.entries()).map(([group, items]) => (
          <div key={group}>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3 capitalize">{group} ({items.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {items.map(e => (
                <EvidenceCard key={e.id} evidence={e} />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderTraitEngine() {
    const traits = intelligence?.traits ?? [];
    if (traits.length === 0) return <p className="text-sm text-gray-600">No traits inferred.</p>;

    return (
      <div className="space-y-3">
        {traits.map(t => (
          <div key={t.trait} className="bg-surface-2 rounded-lg overflow-hidden">
            <button
              className="w-full text-left p-4 flex items-center justify-between gap-3 hover:bg-surface-3 transition-colors"
              onClick={() => setExpandedTrait(expandedTrait === t.trait ? null : t.trait)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-gray-900 capitalize">{t.trait.replace(/_/g, ' ')}</span>
                  <span className="text-xs text-gray-500">{t.weight}/100</span>
                </div>
                <ConfidenceBar value={t.weight} />
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500 shrink-0">
                <span>{t.evidence_ids.length} evidence</span>
                <span className="text-gray-400">{expandedTrait === t.trait ? '▲' : '▼'}</span>
              </div>
            </button>
            {expandedTrait === t.trait && (
              <div className="px-4 pb-4 space-y-2 border-t border-gray-100 pt-3">
                <p className="text-sm text-gray-600">{t.rationale}</p>
                {t.evidence_ids.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-gray-500 mt-2 mb-1">Supporting Evidence IDs</div>
                    <div className="flex flex-wrap gap-1">
                      {t.evidence_ids.map(id => (
                        <code key={id} className="text-[10px] bg-surface-3 px-1.5 py-0.5 rounded text-gray-600">{id}</code>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  function renderArchetypeEngine() {
    const fits = intelligence?.archetype_fits ?? [];
    if (fits.length === 0) return <p className="text-sm text-gray-600">No archetype fits computed.</p>;

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Archetypes</h3>
          {fits.map(f => (
            <button
              key={f.archetype}
              onClick={() => setSelectedArchetype(selectedArchetype === f.archetype ? null : f.archetype)}
              className={`w-full text-left rounded-lg p-3 transition-colors ${selectedArchetype === f.archetype ? 'bg-accent/10 border border-accent/30' : 'bg-surface-2 border border-transparent hover:bg-surface-3'}`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-sm font-semibold text-gray-900">{f.archetype}</span>
                <span className="text-xs font-bold" style={{ color: f.fit_score >= 70 ? 'var(--color-success,#22c55e)' : f.fit_score >= 50 ? 'var(--color-warn,#f59e0b)' : 'var(--color-pink,#ec4899)' }}>{f.fit_score}%</span>
              </div>
              <ConfidenceBar value={f.fit_score} label={f.validation_status.replace(/_/g, ' ')} />
            </button>
          ))}
        </div>
        <div className="lg:col-span-2">
          {selectedArchetype ? (
            (() => {
              const f = fits.find(x => x.archetype === selectedArchetype);
              if (!f) return <p className="text-sm text-gray-600">Select an archetype to inspect.</p>;
              const evidence = intelligence?.evidence ?? [];
              const supporting = evidence.filter(e => f.supporting_evidence_ids.includes(e.id));
              const contradicting = evidence.filter(e => f.contradicting_evidence_ids.includes(e.id));
              return (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">{f.archetype}</h3>
                    <p className="text-xs text-gray-500">Fit: {f.fit_score}% · Confidence: {f.confidence}% · Status: {f.validation_status.replace(/_/g, ' ')} · Selected by creator: {f.selected_by_creator ? 'Yes' : 'No'}</p>
                  </div>
                  {supporting.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-success mb-2">Supporting Evidence ({supporting.length})</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {supporting.map(e => <EvidenceCard key={e.id} evidence={e} />)}
                      </div>
                    </div>
                  )}
                  {contradicting.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-pink mb-2">Contradicting Evidence ({contradicting.length})</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {contradicting.map(e => <EvidenceCard key={e.id} evidence={e} />)}
                      </div>
                    </div>
                  )}
                  {supporting.length === 0 && contradicting.length === 0 && (
                    <p className="text-sm text-gray-600">No evidence linked to this archetype.</p>
                  )}
                </div>
              );
            })()
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-gray-400">Select an archetype to view supporting and contradicting evidence.</div>
          )}
        </div>
      </div>
    );
  }

  function renderCreatorDna() {
    const dna = dnaProfiles[0];
    if (!dna) return <p className="text-sm text-gray-600">No Creator DNA profile stored.</p>;
    const groups: Record<string, Array<[string, string | number | string[]]>> = {
      Identity: [
        ['Primary DNA', dna.creator_dna_primary],
        ['Secondary DNA', dna.creator_dna_secondary],
        ['Confidence', `${dna.confidence}%`],
      ],
      Behaviour: [
        ['Authenticity Band', dna.authenticity_band],
        ['Monetisation Readiness', dna.monetisation_readiness],
        ['Growth Constraints', dna.growth_constraints],
      ],
      Brand: [
        ['Fantasy Archetype', dna.fantasy_archetype],
        ['Archetype Confidence', `${dna.archetype_confidence}%`],
        ['Authenticity Flags', dna.authenticity_flags],
      ],
      Commercial: [
        ['Agency Opportunity', `${dna.agency_opportunity_score}/100`],
        ['Agency Opportunity Band', dna.agency_opportunity_band],
      ],
    };

    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-700">{dna.summary}</p>
        {Object.entries(groups).map(([group, items]) => (
          <div key={group} className="bg-surface-2 rounded-lg overflow-hidden">
            <button
              className="w-full text-left p-4 flex items-center justify-between hover:bg-surface-3 transition-colors"
              onClick={() => setExpandedDnaGroup(expandedDnaGroup === group ? null : group)}
            >
              <span className="text-sm font-semibold text-gray-900">{group}</span>
              <span className="text-xs text-gray-400">{expandedDnaGroup === group ? '▲' : '▼'}</span>
            </button>
            {expandedDnaGroup === group && (
              <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
                {items.map(([label, value]) => (
                  <div key={label} className="bg-surface-1 rounded p-3">
                    <div className="text-xs text-gray-500 mb-1">{label}</div>
                    {Array.isArray(value) ? (
                      value.length > 0 ? (
                        <ul className="list-disc list-inside">
                          {value.map((v, i) => <li key={i} className="text-sm text-gray-700">{v}</li>)}
                        </ul>
                      ) : (
                        <span className="text-sm text-gray-400 italic">None</span>
                      )
                    ) : (
                      <span className="text-sm font-semibold text-gray-900">{value}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  function renderReportPreview() {
    if (!displayedReport) return <p className="text-sm text-gray-600">No report data available.</p>;
    const r = displayedReport;

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">Tier:</span>
          <select
            value={previewTier ?? r.report_tier ?? 'free'}
            onChange={e => setPreviewTier((e.target.value || null) as ReportTier | null)}
            className="field-control text-xs"
          >
            <option value="free">Free</option>
            <option value="premium">Premium</option>
            <option value="agency">Agency</option>
          </select>
          {tierReport && <span className="text-xs text-accent">(recomputed)</span>}
          {!tierReport && storedReport && <span className="text-xs text-gray-400">(stored)</span>}
        </div>

        {/* Archetype */}
        <div className="bg-surface-2 rounded-lg p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Archetype</h3>
          <p className="text-lg font-bold text-gray-900">{r.archetype}</p>
          <p className="text-sm text-gray-700 mt-1">{r.archetype_description}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
            <div>
              <div className="text-xs font-semibold text-success mb-1">Strengths</div>
              <ul className="list-disc list-inside space-y-0.5">
                {r.archetype_strengths.map(s => <li key={s} className="text-xs text-gray-700">{s}</li>)}
              </ul>
            </div>
            <div>
              <div className="text-xs font-semibold text-warn mb-1">Risks</div>
              <ul className="list-disc list-inside space-y-0.5">
                {r.archetype_risks.map(s => <li key={s} className="text-xs text-gray-700">{s}</li>)}
              </ul>
            </div>
            <div>
              <div className="text-xs font-semibold text-accent mb-1">Growth</div>
              <ul className="list-disc list-inside space-y-0.5">
                {r.archetype_growth.map(s => <li key={s} className="text-xs text-gray-700">{s}</li>)}
              </ul>
            </div>
          </div>
        </div>

        {/* Scores */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {Object.entries(r.scores).map(([k, v]) => (
            <div key={k} className="bg-surface-2 rounded-lg p-3 text-center">
              <div className={`text-xl font-bold ${v >= 60 ? 'text-success' : v >= 40 ? 'text-warn' : 'text-pink'}`}>{v}</div>
              <div className="text-[10px] text-gray-500 mt-1 capitalize">{k.replace(/_/g, ' ')}</div>
            </div>
          ))}
        </div>

        {/* Summary */}
        {r.executive_summary && (
          <div className="bg-surface-2 rounded-lg p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Executive Summary</h3>
            <p className="text-sm text-gray-700">{r.executive_summary.likely_creator_style}</p>
            <p className="text-sm text-gray-700 mt-1">{r.executive_summary.recommended_next_step}</p>
          </div>
        )}

        {/* Why */}
        <div className="bg-surface-2 rounded-lg p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Why This Result</h3>
          <p className="text-sm text-gray-700">{r.why_this_result.summary}</p>
        </div>

        {/* Day 90 Plan */}
        {r.day_90_plan && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">90-Day Plan</h3>
            <div className="space-y-3">
              {r.day_90_plan.map(phase => (
                <div key={phase.phase} className="bg-surface-2 rounded-lg p-4">
                  <div className="text-sm font-semibold text-gray-900">{phase.phase}</div>
                  <div className="text-xs text-gray-500 mb-2">{phase.focus}</div>
                  <ul className="list-disc list-inside space-y-0.5">
                    {phase.actions.map(a => <li key={a} className="text-xs text-gray-700">{a}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderAgencyReview() {
    const stored = storedReport?.report_json as Partial<ReportData> | undefined;
    const scores = stored?.internal_agency_scores;
    const recommendation = stored?.agency_recommendation;
    const dna = dnaProfiles[0];

    return (
      <div className="space-y-6">
        {/* Internal Scores */}
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Internal Agency Scores</h3>
          {scores ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                ['Commercial Potential', scores.commercial_potential],
                ['Management Readiness', scores.management_readiness],
                ['Coachability', scores.coachability],
                ['Ambition', scores.ambition],
                ['Innovation', scores.innovation],
                ['Parasocial Strength', scores.parasocial_strength],
                ['Brand Risk', scores.brand_risk, true],
                ['Scalability', scores.scalability],
                ['Agency Opportunity', scores.agency_opportunity],
              ].map(([l, v, inv]) => (
                <div key={l} className="bg-surface-2 rounded-lg p-3 text-center">
                  <div className={`text-xl font-bold ${(inv ? (v ?? 0) <= 40 : (v ?? 0) >= 70) ? 'text-success' : (inv ? (v ?? 0) <= 65 : (v ?? 0) >= 45) ? 'text-warn' : 'text-pink'}`}>{v ?? '-'}</div>
                  <div className="text-[10px] text-gray-500 mt-1 leading-tight">{l}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-600">No internal scores stored.</p>
          )}
        </div>

        {/* Recommendation */}
        {recommendation && (
          <div className="bg-surface-2 rounded-lg p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Agency Recommendation</h3>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-gray-500">Priority</div>
                <div className={`text-sm font-bold ${recommendation.agency_priority === 'high' ? 'text-accent' : recommendation.agency_priority === 'medium' ? 'text-warn' : 'text-gray-600'}`}>{recommendation.agency_priority.toUpperCase()}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Recommended Next Action</div>
                <p className="text-sm text-gray-700">{recommendation.recommended_next_action}</p>
              </div>
              <div>
                <div className="text-xs text-gray-500">Management Fit</div>
                <p className="text-sm text-gray-700">{recommendation.management_fit_summary}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="border border-pink/20 bg-pink/5 rounded-lg p-3">
                  <div className="text-xs font-semibold text-pink mb-2">Risk Indicators</div>
                  <ul className="list-disc list-inside space-y-1">
                    {recommendation.risk_notes.map((n, i) => <li key={i} className="text-xs text-gray-700">{n}</li>)}
                  </ul>
                </div>
                <div className="border border-success/20 bg-success/5 rounded-lg p-3">
                  <div className="text-xs font-semibold text-success mb-2">Opportunities</div>
                  <ul className="list-disc list-inside space-y-1">
                    {recommendation.opportunity_notes.map((n, i) => <li key={i} className="text-xs text-gray-700">{n}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* DNA-based agency indicators */}
        {dna && (
          <div className="bg-surface-2 rounded-lg p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">DNA Agency Indicators</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                ['Coachability Signal', dna.creator_dna_primary === 'Connection & Community' ? 'High' : 'Moderate'],
                ['Commercial Readiness', dna.monetisation_readiness],
                ['Growth Constraints', dna.growth_constraints.join(', ')],
                ['Authenticity Risk', dna.authenticity_band],
              ].map(([l, v]) => (
                <div key={l} className="bg-surface-1 rounded p-3">
                  <div className="text-xs text-gray-500">{l}</div>
                  <div className="text-sm font-semibold text-gray-900 mt-1">{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Editable notes */}
        <div className="bg-surface-2 rounded-lg p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Agency Notes</h3>
          <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
            {notes.length === 0 && <p className="text-xs text-gray-500">No notes yet.</p>}
            {notes.map(n => (
              <div key={n.id} className="bg-surface-1 rounded p-2">
                <p className="text-xs text-gray-700">{n.note}</p>
                <p className="text-[10px] text-gray-400 mt-1">{new Date(n.created_at!).toLocaleString()}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addNote()}
              placeholder="Add an agency note..."
              className="field-control flex-1 text-sm"
              disabled={noteSaving}
            />
            <button onClick={addNote} disabled={!noteText.trim() || noteSaving} className="btn-primary px-3 text-sm">
              {noteSaving ? '...' : 'Add'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderTimeline() {
    if (events.length === 0) return <p className="text-sm text-gray-600">No lifecycle events recorded.</p>;

    const relevant = events.filter(e => {
      const type = e.event_type;
      return type.includes('assessment') || type.includes('invite') || type.includes('report') || type.includes('strategy') || type.includes('agency') || type.includes('booking') || type.includes('calendar');
    });

    const display = relevant.length > 0 ? relevant : events;

    return (
      <div className="space-y-2">
        {display.map(e => (
          <div key={e.id} className="flex gap-3">
            <div className="w-2 h-2 rounded-full bg-accent mt-2 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-800 capitalize">{e.event_type.replace(/_/g, ' ').replace(/\./g, ' · ')}</p>
              <p className="text-xs text-gray-500">{new Date(e.created_at!).toLocaleString()}</p>
              {e.details && Object.keys(e.details).length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {Object.entries(e.details).slice(0, 5).map(([k, v]) => (
                    <span key={k} className="text-[10px] bg-surface-3 px-1.5 py-0.5 rounded text-gray-600">{k}: {String(v).slice(0, 60)}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── main render ──

  return (
    <div className="cockpit-page">
      <header className="cockpit-page-header">
        <div>
          <button onClick={() => navigate(`/cockpit/creators/${profileId}`)} className="mb-2 inline-block text-xs font-medium text-gray-500 transition-colors hover:text-accent">&larr; Back to Creator</button>
          <p className="cockpit-eyebrow">Creator Intelligence</p>
          <h1 className="cockpit-title">{profile.full_name}</h1>
          <p className="cockpit-subtitle">
            {templateName} · {selectedAssessment ? new Date(selectedAssessment.created_at).toLocaleDateString() : 'No assessment'} · {intelligence ? `${intelligence.evidence.length} evidence signals` : 'No data'}
          </p>
        </div>
        {assessments.length > 1 && (
          <select
            value={selectedAssessmentId}
            onChange={e => setSelectedAssessmentId(e.target.value)}
            className="field-control text-sm"
          >
            {assessments.map(a => (
              <option key={a.id} value={a.id}>
                {new Date(a.created_at).toLocaleDateString()} — {a.assessment_snapshot?.template_name ?? a.template_slug ?? 'Assessment'}
              </option>
            ))}
          </select>
        )}
      </header>

      {/* Tab bar */}
      <div className="border-b border-gray-200 mb-6 overflow-x-auto">
        <div className="flex gap-0 min-w-max">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === t.id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="cockpit-card-pad">
        {tab === 'overview' && renderOverview()}
        {tab === 'responses' && renderRawResponses()}
        {tab === 'evidence' && renderEvidence()}
        {tab === 'traits' && renderTraitEngine()}
        {tab === 'archetypes' && renderArchetypeEngine()}
        {tab === 'dna' && renderCreatorDna()}
        {tab === 'report' && renderReportPreview()}
        {tab === 'agency' && renderAgencyReview()}
        {tab === 'timeline' && renderTimeline()}
      </div>

      {/* Debug: missing data warning */}
      {!intelligence && selectedAssessment && (
        <div className="mt-4 rounded-lg border border-warn/30 bg-warn/10 p-3 text-xs text-warn">
          Client-side intelligence recomputation failed or returned no data. The assessment snapshot may be incomplete. Check the raw responses tab for stored data.
        </div>
      )}
    </div>
  );
}
