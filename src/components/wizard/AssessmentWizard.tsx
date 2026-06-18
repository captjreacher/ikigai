import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { submitAssessment } from '@/lib/creators-api';
import type { AssessmentResponses } from '@/types/creator';

type WizardStep = 0 | 1 | 2 | 3 | 4;

const INITIAL: AssessmentResponses = {
  strengths: [],
  comfort_level: 5,
  passion_topic: '',
  persona_occupation: '',
  parasocial_comfort: false,
  fantasy_keywords: '',
  nudity_level: '',
  niche_interests: [],
  audience_target: null,
  full_name: '',
  email: '',
  country: '',
  consent: false,
};

const STEPS = ['Strengths', 'Persona', 'Boundaries', 'Goals', 'Submit'];

const STRENGTH_OPTIONS = ['Humor', 'Dancing', 'Public Speaking', 'Specific Sport', 'Specialized Knowledge/Astrology', 'High-Energy', 'Aesthetic/Cozy'];
const PERSONA_OPTIONS = ['Struggling student', 'Professional athlete', 'Corporate rebel', 'Cosy stay-at-home mom', 'Fitness enthusiast', 'Artist / creative', 'Spiritual guide', 'Party girl', 'Other'];
const NICHE_OPTIONS = ['Armpits', 'Feet', 'Fitness/Muscle', 'Roleplay', 'Daddy dynamic', 'High-Fashion'];
const NUDITY_OPTIONS = [
  { value: 'sfw_only', label: 'SFW only' },
  { value: 'teasing_only', label: 'Teasing only' },
  { value: 'topless', label: 'Topless' },
  { value: 'full_nude', label: 'Full nude' },
  { value: 'fetish', label: 'Fetish-specific' },
];

export function AssessmentWizard() {
  const [step, setStep] = useState<WizardStep>(0);
  const [data, setData] = useState<AssessmentResponses>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const update = <K extends keyof AssessmentResponses>(k: K, v: AssessmentResponses[K]) =>
    setData(d => ({ ...d, [k]: v }));

  const toggleArray = (field: 'strengths' | 'niche_interests', value: string) => {
    setData(d => ({
      ...d,
      [field]: d[field].includes(value)
        ? d[field].filter(x => x !== value)
        : [...d[field], value],
    }));
  };

  const canNext = (): boolean => {
    switch (step) {
      case 0: return data.strengths.length > 0;
      case 1: return data.persona_occupation !== '';
      case 2: return data.nudity_level !== '';
      case 3: return data.audience_target !== null;
      case 4: return data.full_name !== '' && data.email !== '' && data.country !== '' && data.consent;
      default: return true;
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const result = await submitAssessment(data);
      navigate(`/report/${result.report.report_slug}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="font-display text-3xl font-bold mb-2">Creator Ikigai</h1>
          <p className="text-gray-500 text-sm">Brand Strategy Wizard</p>
        </div>

        {/* Progress */}
        <div className="flex gap-2 mb-10">
          {STEPS.map((label, i) => (
            <div key={label} className="flex-1">
              <div className={`h-1 rounded-full transition-colors ${i <= step ? 'bg-accent' : 'bg-surface-3'}`} />
              <span className={`text-xs mt-1 block ${i <= step ? 'text-accent' : 'text-gray-600'}`}>{label}</span>
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-900/20 border border-red-800 text-red-300 rounded-lg px-4 py-3 mb-6 text-sm">
            {error}
          </div>
        )}

        {/* Step 0: Strengths */}
        {step === 0 && (
          <div className="space-y-6 animate-in">
            <h2 className="font-display text-xl font-semibold">What are your top three natural ingredients?</h2>
            <p className="text-gray-500 text-sm">Select all that apply</p>
            <div className="flex flex-wrap gap-2">
              {STRENGTH_OPTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => toggleArray('strengths', s)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                    data.strengths.includes(s)
                      ? 'bg-accent/20 border-accent text-accent'
                      : 'border-gray-700 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">
                Rate your comfort level in front of the camera (1-10)
              </label>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">1</span>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={data.comfort_level}
                  onChange={e => update('comfort_level', parseInt(e.target.value))}
                  className="flex-1 accent-accent"
                />
                <span className="text-xs text-gray-500">10</span>
                <span className="font-display text-xl text-accent ml-2 w-6 text-center">{data.comfort_level}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">
                What is one topic you could talk about for 30 minutes without preparation?
              </label>
              <textarea
                value={data.passion_topic}
                onChange={e => update('passion_topic', e.target.value)}
                placeholder="E.g., astrology, vintage fashion, conspiracy theories..."
                rows={3}
                className="w-full bg-surface-2 border border-gray-700 rounded-lg px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-accent resize-none"
              />
            </div>
          </div>
        )}

        {/* Step 1: Persona */}
        {step === 1 && (
          <div className="space-y-6 animate-in">
            <h2 className="font-display text-xl font-semibold">Identify your persona's backstory</h2>
            <p className="text-gray-500 text-sm">What's your character's "occupation" or storyline?</p>
            <div className="grid grid-cols-2 gap-2">
              {PERSONA_OPTIONS.map(p => (
                <button
                  key={p}
                  onClick={() => update('persona_occupation', p)}
                  className={`px-4 py-3 rounded-lg text-sm font-medium border transition-all text-left ${
                    data.persona_occupation === p
                      ? 'bg-accent/20 border-accent text-accent'
                      : 'border-gray-700 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">
                  Comfortable sharing personal/dating stories to build parasocial bonds?
                </label>
                <div className="flex gap-2">
                  {(['Yes', 'No'] as const).map(v => (
                    <button
                      key={v}
                      onClick={() => update('parasocial_comfort', v === 'Yes')}
                      className={`px-6 py-2 rounded-full text-sm font-medium border transition-all ${
                        data.parasocial_comfort === (v === 'Yes')
                          ? 'bg-pink/20 border-pink text-pink'
                          : 'border-gray-700 text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">
                  Describe your hottest fantasy in three keywords
                </label>
                <input
                  type="text"
                  value={data.fantasy_keywords}
                  onChange={e => update('fantasy_keywords', e.target.value)}
                  placeholder="E.g., power, submission, luxury"
                  className="w-full bg-surface-2 border border-gray-700 rounded-lg px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-accent"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Boundaries */}
        {step === 2 && (
          <div className="space-y-6 animate-in">
            <h2 className="font-display text-xl font-semibold">Set your boundaries</h2>

            <div>
              <label className="block text-sm font-medium mb-3 text-gray-300">Nudity comfort level</label>
              <div className="grid grid-cols-2 gap-2">
                {NUDITY_OPTIONS.map(o => (
                  <button
                    key={o.value}
                    onClick={() => update('nudity_level', o.value)}
                    className={`px-4 py-3 rounded-lg text-sm font-medium border transition-all text-left ${
                      data.nudity_level === o.value
                        ? 'bg-pink/20 border-pink text-pink'
                        : 'border-gray-700 text-gray-400 hover:border-gray-500'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-3 text-gray-300">Natural niche interests</label>
              <p className="text-gray-500 text-xs mb-3">Select any that resonate</p>
              <div className="grid grid-cols-2 gap-2">
                {NICHE_OPTIONS.map(n => (
                  <button
                    key={n}
                    onClick={() => toggleArray('niche_interests', n)}
                    className={`px-4 py-3 rounded-lg text-sm font-medium border transition-all text-left ${
                      data.niche_interests.includes(n)
                        ? 'bg-accent/20 border-accent text-accent'
                        : 'border-gray-700 text-gray-400 hover:border-gray-500'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Goals */}
        {step === 3 && (
          <div className="space-y-6 animate-in">
            <h2 className="font-display text-xl font-semibold">Define your audience</h2>
            <p className="text-gray-500 text-sm">This shapes your entire monetisation strategy</p>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => update('audience_target', 'whales')}
                className={`p-5 rounded-xl border-2 transition-all text-left ${
                  data.audience_target === 'whales'
                    ? 'border-accent bg-accent/10'
                    : 'border-gray-700 hover:border-gray-500'
                }`}
              >
                <div className="text-2xl mb-2">🐋</div>
                <div className="font-semibold text-gray-100">Whales</div>
                <p className="text-xs text-gray-500 mt-1">High-spending executives seeking luxury & exclusivity. Low volume, high revenue per sub.</p>
              </button>
              <button
                onClick={() => update('audience_target', 'masses')}
                className={`p-5 rounded-xl border-2 transition-all text-left ${
                  data.audience_target === 'masses'
                    ? 'border-accent bg-accent/10'
                    : 'border-gray-700 hover:border-gray-500'
                }`}
              >
                <div className="text-2xl mb-2">🌊</div>
                <div className="font-semibold text-gray-100">The Masses</div>
                <p className="text-xs text-gray-500 mt-1">High-volume casual subscribers. Quantity over ticket size. Free trial + upsell model.</p>
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Submit */}
        {step === 4 && (
          <div className="space-y-6 animate-in">
            <h2 className="font-display text-xl font-semibold">Almost done — who are you?</h2>
            <div className="space-y-4">
              <input
                type="text"
                value={data.full_name}
                onChange={e => update('full_name', e.target.value)}
                placeholder="Full name / stage name"
                className="w-full bg-surface-2 border border-gray-700 rounded-lg px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-accent"
              />
              <input
                type="email"
                value={data.email}
                onChange={e => update('email', e.target.value)}
                placeholder="Email address"
                className="w-full bg-surface-2 border border-gray-700 rounded-lg px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-accent"
              />
              <input
                type="text"
                value={data.country}
                onChange={e => update('country', e.target.value)}
                placeholder="Country"
                className="w-full bg-surface-2 border border-gray-700 rounded-lg px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-accent"
              />
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={data.consent}
                  onChange={e => update('consent', e.target.checked)}
                  className="mt-1 accent-accent"
                />
                <span className="text-sm text-gray-400">
                  I consent to being contacted regarding creator management services.
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3 mt-10">
          {step > 0 && (
            <button
              onClick={() => setStep(s => (s - 1) as WizardStep)}
              className="px-6 py-2.5 rounded-lg border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-500 transition-all text-sm font-medium"
            >
              Back
            </button>
          )}
          {step < 4 ? (
            <button
              onClick={() => setStep(s => (s + 1) as WizardStep)}
              disabled={!canNext()}
              className="ml-auto px-6 py-2.5 rounded-lg bg-accent hover:bg-accent-2 text-gray-950 font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!canNext() || submitting}
              className="ml-auto px-6 py-2.5 rounded-lg bg-accent hover:bg-accent-2 text-gray-950 font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? 'Generating report...' : 'Get my Brand Strategy Report'}
            </button>
          )}
        </div>
        <p className="text-xs text-gray-600 text-center mt-4">
          Step {step + 1} of {STEPS.length}
        </p>
      </div>
    </div>
  );
}
