// ─────────────────────────────────────────────────────────────────────────────
// Creator Intelligence — Knowledge Registry: Audiences (Sprint FYV-3.4A)
//
// Baseline audience profiles keyed by the existing AudienceStrategy union
// ('whales' | 'masses') plus a neutral 'default' fallback.
// ─────────────────────────────────────────────────────────────────────────────

import type { AudienceKnowledge, AudienceProfileKey } from './types';

export const AUDIENCE_KNOWLEDGE: Record<AudienceProfileKey, AudienceKnowledge> = {
  whales: {
    key: 'whales',
    label: 'High-Value Fans (Whales)',
    motivations: [
      'Exclusive access and VIP treatment',
      'Personal attention and recognition',
      'Premium, bespoke experiences',
      'Status and scarcity signalling',
    ],
    buyingBehaviour: 'Spends significantly and frequently; gravitates to top tiers, custom requests, and exclusive offers. Price-insensitive when value feels personal.',
    retentionDrivers: [
      'Consistent personal recognition',
      'Escalating exclusivity over time',
      'Priority access to new content and offers',
      'Feeling genuinely known and remembered',
    ],
    conversationStyle: 'Expects prompt, personal, high-quality responses. Values being addressed by name and having preferences remembered.',
    upsellOpportunities: [
      'Bespoke custom content commissions',
      'Top-tier VIP subscription levels',
      'Priority DM access',
      'Limited-run exclusive drops',
      'Personalised experiences and shout-outs',
    ],
    riskIndicators: [
      'Entitlement escalation — demanding beyond boundaries',
      'Dependency on a small number of high spenders',
      'Revenue volatility if a whale churns',
      'Boundary-pushing requests requiring firm management',
    ],
  },
  masses: {
    key: 'masses',
    label: 'Volume Fans (Masses)',
    motivations: [
      'Affordable access to engaging content',
      'Community belonging and shared experience',
      'Entertainment and escapism',
      'Feeling part of something active and social',
    ],
    buyingBehaviour: 'Spends modestly per transaction but aggregates at volume. Responsive to bundles, limited-time offers, and low-friction purchases.',
    retentionDrivers: [
      'Consistent content cadence',
      'Community engagement and interaction',
      'Affordable ongoing value',
      'Fresh content variety and format rotation',
    ],
    conversationStyle: 'Prefers broadcast-style engagement — mass messages, polls, community posts. Appreciates occasional personal touches but does not expect 1:1 attention.',
    upsellOpportunities: [
      'Bundle and multi-buy discounts',
      'Limited-time flash sales',
      'Community-event tip jars',
      'Social-proof-driven content drops',
      'Referral incentives',
    ],
    riskIndicators: [
      'High churn sensitivity to price increases',
      'Low individual LTV makes acquisition cost critical',
      'Content fatigue from volume pressure',
      'Difficult to convert to premium tiers',
    ],
  },
  default: {
    key: 'default',
    label: 'Mixed / Unspecified Audience',
    motivations: [
      'A blend of connection, entertainment, and value',
      'Exploring what type of creator experience fits',
      'No single dominant motivation yet identified',
    ],
    buyingBehaviour: 'Spending pattern not yet established. Likely a mix of modest subscriptions and occasional impulse purchases.',
    retentionDrivers: [
      'Consistent content quality',
      'Clear value proposition',
      'Positive early experience',
      'Ease of engagement',
    ],
    conversationStyle: 'Default to friendly, approachable broadcast style with periodic personal touches.',
    upsellOpportunities: [
      'Introductory bundles to discover preferences',
      'Segmentation tests to identify whale vs. volume behaviour',
      'Engagement-triggered upgrades',
    ],
    riskIndicators: [
      'Unclear strategy leads to scattered effort',
      'Hard to optimise pricing without audience clarity',
      'Risk of under-serving both whales and masses',
    ],
  },
};

/** Convenience accessor used by the registry layer. */
export function audienceKnowledgeFor(key: AudienceProfileKey): AudienceKnowledge {
  return AUDIENCE_KNOWLEDGE[key] ?? AUDIENCE_KNOWLEDGE['default'];
}
