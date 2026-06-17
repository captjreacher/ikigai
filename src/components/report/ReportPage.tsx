import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getReportBySlug } from '@/lib/creators-api';
import type { CreatorReport, ReportData } from '@/types/creator';

function ScoreBar({ label, score }: { label: string; score: number }) {
  const color = score >= 70 ? 'bg-success' : score >= 45 ? 'bg-warn' : 'bg-pink';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-400">{label}</span>
        <span className="font-semibold text-gray-200">{score}/100</span>
      </div>
      <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function ScoreCard({ title, scores }: { title: string; scores: Record<string, number> }) {
  return (
    <div className="bg-surface border border-gray-800 rounded-xl p-5">
      <h3 className="font-display font-semibold text-lg mb-4">{title}</h3>
      <div className="space-y-3">
        {Object.entries(scores).map(([k, v]) => (
          <ScoreBar key={k} label={k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} score={v} />
        ))}
      </div>
    </div>
  );
}

function ReadinessBadge({ readiness }: { readiness: string }) {
  const colors: Record<string, string> = {
    'Scale Candidate': 'bg-success/20 text-success border-success/30',
    'Ready Now': 'bg-accent/20 text-accent border-accent/30',
    'Needs Foundation': 'bg-warn/20 text-warn border-warn/30',
    'Hobby Creator': 'bg-gray-700/50 text-gray-400 border-gray-600',
  };
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${colors[readiness] ?? 'border-gray-700 text-gray-400'}`}>
      {readiness}
    </span>
  );
}

export function ReportPage() {
  const { slug } = useParams<{ slug: string }>();
  const [report, setReport] = useState<CreatorReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    getReportBySlug(slug).then(r => { setReport(r); setLoading(false); });
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="animate-pulse text-gray-500">Loading report...</div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 p-4">
        <h1 className="font-display text-2xl font-bold mb-4">Report Not Found</h1>
        <p className="text-gray-500 mb-6">This report link may have expired or been moved.</p>
        <Link to="/" className="text-accent hover:underline text-sm">← Take the assessment</Link>
      </div>
    );
  }

  const d = report.report_json as unknown as ReportData;

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Hero */}
      <div className="border-b border-gray-800 bg-surface/50">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <Link to="/" className="text-xs text-gray-500 hover:text-gray-300 mb-4 inline-block">← Back to assessment</Link>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="font-display text-3xl font-bold mb-2">{d.archetype}</h1>
              <p className="text-gray-400 max-w-lg">{d.archetype_description}</p>
            </div>
            <ReadinessBadge readiness={d.management_readiness} />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-10">
        {/* Scores */}
        <ScoreCard title="Creator Scores" scores={d.scores} />

        {/* Archetype Deep Dive */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-surface border border-green-900/30 rounded-xl p-5">
            <h3 className="font-semibold text-success mb-3 text-sm uppercase tracking-wide">Strengths</h3>
            <ul className="space-y-2">{d.archetype_strengths.map(s => <li key={s} className="text-sm text-gray-300 flex gap-2"><span className="text-success">+</span>{s}</li>)}</ul>
          </div>
          <div className="bg-surface border border-pink/20 rounded-xl p-5">
            <h3 className="font-semibold text-pink mb-3 text-sm uppercase tracking-wide">Risks</h3>
            <ul className="space-y-2">{d.archetype_risks.map(s => <li key={s} className="text-sm text-gray-300 flex gap-2"><span className="text-pink">!</span>{s}</li>)}</ul>
          </div>
          <div className="bg-surface border border-accent/20 rounded-xl p-5">
            <h3 className="font-semibold text-accent mb-3 text-sm uppercase tracking-wide">Growth</h3>
            <ul className="space-y-2">{d.archetype_growth.map(s => <li key={s} className="text-sm text-gray-300 flex gap-2"><span className="text-accent">→</span>{s}</li>)}</ul>
          </div>
        </section>

        {/* Top 3 Verticals */}
        <section>
          <h2 className="font-display text-xl font-semibold mb-4">Top 3 Content Verticals</h2>
          <p className="text-sm text-gray-500 mb-4">Test these over a 6-week period to find your highest-converting format.</p>
          <div className="space-y-3">
            {d.top_verticals.map((v, i) => (
              <div key={v.name} className="bg-surface border border-gray-800 rounded-xl p-5 flex gap-4">
                <span className="font-display text-3xl text-accent shrink-0">0{i + 1}</span>
                <div>
                  <h3 className="font-semibold text-gray-100">{v.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{v.rationale}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section>
          <h2 className="font-display text-xl font-semibold mb-4">Pricing & Monetisation Strategy</h2>
          <div className="bg-surface border border-accent/20 rounded-xl p-5">
            <p className="text-sm text-gray-300 leading-relaxed">{d.pricing_strategy}</p>
          </div>
        </section>

        {/* Winning 10 */}
        <section>
          <h2 className="font-display text-xl font-semibold mb-4">The Winning 10 Framework</h2>
          <div className="bg-surface border border-gray-800 rounded-xl p-5">
            <p className="text-sm text-gray-300 leading-relaxed">{d.winning_10_framework}</p>
          </div>
        </section>

        {/* Growth Strategy */}
        <section>
          <h2 className="font-display text-xl font-semibold mb-4">Growth Strategy: Viral Billboards</h2>
          <div className="bg-surface border border-gray-800 rounded-xl p-5">
            <p className="text-sm text-gray-300 leading-relaxed">{d.growth_strategy}</p>
          </div>
        </section>

        {/* Tech Stack */}
        <section>
          <h2 className="font-display text-xl font-semibold mb-4">Recommended Tech Stack</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {d.tech_stack.map(t => (
              <div key={t.tool} className="bg-surface border border-gray-800 rounded-xl p-4">
                <h3 className="font-semibold text-accent">{t.tool}</h3>
                <p className="text-xs text-gray-500 mt-1">{t.purpose}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 90-Day Plan */}
        <section>
          <h2 className="font-display text-xl font-semibold mb-4">90-Day Action Plan</h2>
          <div className="space-y-4">
            {d.day_90_plan.map((phase, i) => (
              <div key={phase.phase} className="bg-surface border border-gray-800 rounded-xl p-5">
                <h3 className="font-semibold text-accent mb-1">{phase.phase}</h3>
                <p className="text-xs text-gray-500 mb-3">{phase.focus}</p>
                <ul className="space-y-1.5">
                  {phase.actions.map(a => (
                    <li key={a} className="text-sm text-gray-300 flex gap-2">
                      <span className="text-gray-600 shrink-0">{i + 1}.{phase.actions.indexOf(a) + 1}</span>
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Share CTA */}
        <div className="text-center py-6 border-t border-gray-800">
          <p className="text-xs text-gray-600">
            Share this report: {window.location.href}
          </p>
        </div>
      </div>
    </div>
  );
}
