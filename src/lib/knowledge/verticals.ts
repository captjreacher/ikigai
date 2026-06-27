// ─────────────────────────────────────────────────────────────────────────────
// Creator Intelligence — Knowledge Registry: Verticals (Sprint FYV-3.4A)
//
// Baseline strategic knowledge for all 10 content verticals defined by the
// ContentVertical union in @/types/creator.
//
// The map is typed as Record<ContentVertical, VerticalKnowledge>, so the
// compiler enforces that every vertical has an entry.
// ─────────────────────────────────────────────────────────────────────────────

import type { ContentVertical } from '@/types/creator';
import type { VerticalKnowledge, VerticalKey } from './types';

export const VERTICAL_KNOWLEDGE: Record<ContentVertical, VerticalKnowledge> = {
  'Skill-Based Challenges': {
    vertical: 'Skill-Based Challenges',
    audience: 'Fans who enjoy interactive, competitive, or skill-demonstration content and want to participate or be impressed.',
    contentPillars: ['Challenge reveals and outcomes', 'Fan-submitted challenges', 'Skill progression arcs', 'Competitive collaborations'],
    growthStrategies: ['Cross-platform challenge clips for discovery', 'Fan participation loops', 'Trend-jacking challenge formats', 'Collaboration with complementary creators'],
    monetisationOpportunities: ['PPV challenge outcomes', 'Custom challenge requests', 'Tiered access to participation', 'Tip-gated reveals'],
    retentionStrategies: ['Recurring challenge series', 'Fan voting and input', 'Streak and progression tracking', 'Community leaderboards'],
    creatorChallenges: ['Content idea fatigue', 'Maintaining escalation without burnout', 'Keeping challenges fresh and on-brand'],
    successIndicators: ['High engagement rate on challenge posts', 'Fan-initiated challenge submissions', 'Strong PPV conversion on reveals', 'Consistent series return rate'],
  },
  'Polarizing Storytimes': {
    vertical: 'Polarizing Storytimes',
    audience: 'Fans drawn to drama, confession, and real-life narrative tension — they want to react, share, and take sides.',
    contentPillars: ['Real-life confessional narratives', 'Opinion-driven hot takes', 'Cliffhanger and serial storytelling', 'Audience reaction hooks'],
    growthStrategies: ['Clip-to-full pipeline on social platforms', 'Controversy-adjacent (not violating) hooks', 'Engagement-bait captions', 'Collaboration storytime swaps'],
    monetisationOpportunities: ['PPV story conclusions', 'Exclusive "full story" tiers', 'Tip-for-next-chapter mechanics', 'Premium behind-the-story context'],
    retentionStrategies: ['Serial cliffhangers', 'Recurring "story night" schedule', 'Fan poll on next topic', 'Callback references to prior stories'],
    creatorChallenges: ['Maintaining authenticity under narrative pressure', 'Privacy and over-disclosure risk', 'Sustaining story supply without fabrication'],
    successIndicators: ['High comment and share rate', 'Strong clip-to-sub conversion', 'Recurring viewership on series', 'Fan requests for specific story topics'],
  },
  'Lifestyle Vlogging / GRWM': {
    vertical: 'Lifestyle Vlogging / GRWM',
    audience: 'Fans who want to feel part of the creator\'s everyday life — parasocial intimacy through routine and process.',
    contentPillars: ['Get-ready-with-me routines', 'Day-in-the-life vlogs', 'Behind-the-scenes preparation', 'Lifestyle aspirational moments'],
    growthStrategies: ['Routine-format clips for social discovery', 'Aesthetic consistency for brand recognition', 'Product and brand tie-ins', 'Collaborative GRWM with other creators'],
    monetisationOpportunities: ['Extended cut PPV', 'Product recommendation affiliate revenue', 'Sponsorship and brand deals', 'Premium "unfiltered" tiers'],
    retentionStrategies: ['Daily or weekly routine cadence', 'Ritual consistency fans can anticipate', 'Seasonal and event-themed variations', 'Fan Q&A integrated into routines'],
    creatorChallenges: ['Maintaining freshness in repetitive formats', 'Privacy in lifestyle content', 'Production fatigue from daily cadence'],
    successIndicators: ['Consistent viewership on routine content', 'High watch-through rates', 'Brand deal inquiries', 'Fan comments referencing routine details'],
  },
  'Comedy Skits': {
    vertical: 'Comedy Skits',
    audience: 'Fans who value humour and personality — they subscribe for the creator, not just the content type.',
    contentPillars: ['Character-driven sketches', 'Relatable situational comedy', 'Parody and satire', 'Recurring bit characters'],
    growthStrategies: ['Short-form clips for viral social reach', 'Trend-format comedy adaptations', 'Collaboration with comedy creators', 'Fan-suggested sketch topics'],
    monetisationOpportunities: ['Extended/uncensored sketch PPV', 'Custom comedy requests', 'Behind-the-scenes and blooper content', 'Merch based on recurring characters'],
    retentionStrategies: ['Recurring characters fans attach to', 'Series-format sketch arcs', 'Fan interaction and suggestion loops', 'Consistent posting schedule'],
    creatorChallenges: ['Comedy writing consistency', 'Balancing humour with other content types', 'Avoiding repetition', 'Production time for scripted content'],
    successIndicators: ['High share and save rates', 'Fan quoting or referencing sketches', 'Strong social-to-sub conversion', 'Recurring character fan engagement'],
  },
  'Confessional Storytime': {
    vertical: 'Confessional Storytime',
    audience: 'Fans who crave vulnerability, secrets, and authentic emotional disclosure — they feel trusted and close.',
    contentPillars: ['Personal confessions and secrets', 'Emotional vulnerability moments', 'First-time and milestone stories', 'Real-talk relationship narratives'],
    growthStrategies: ['Teaser clips with emotional hooks', 'Relatable confession topics for broad appeal', 'Community confession threads', 'Authenticity as the brand differentiator'],
    monetisationOpportunities: ['Full confession PPV', 'Exclusive "never told anyone" tiers', 'Interactive confession Q&A', 'Tip-gated emotional reveals'],
    retentionStrategies: ['Serialised emotional arcs', 'Fan confession exchanges', 'Recurring confession schedule', 'Building trust through consistent vulnerability'],
    creatorChallenges: ['Over-disclosure and privacy risk', 'Emotional toll of vulnerability', 'Maintaining authenticity as content scales', 'Boundary management with invested fans'],
    successIndicators: ['High DM engagement after confessional content', 'Fan emotional responses and sharing', 'Strong retention on confession series', 'Trust-signal growth in fan messages'],
  },
  'Fitness Journey': {
    vertical: 'Fitness Journey',
    audience: 'Fans motivated by transformation, discipline, and aspirational body and health goals.',
    contentPillars: ['Workout routines and demonstrations', 'Progress and transformation updates', 'Nutrition and lifestyle advice', 'Body confidence and motivation'],
    growthStrategies: ['Before/after transformation hooks', 'Cross-platform fitness content funnel', 'Fitness challenge collaborations', 'Trend-format workout clips'],
    monetisationOpportunities: ['Program and guide sales', 'Premium workout PPV', 'Custom training plans', 'Sponsorship from fitness brands'],
    retentionStrategies: ['Progression tracking with fans', 'Recurring workout series', 'Community fitness challenges', 'Seasonal goal-setting cycles'],
    creatorChallenges: ['Body image pressure and comparison', 'Sustaining visual progress content', 'Injury and burnout risk', 'Balancing fitness and other content types'],
    successIndicators: ['Fan progress sharing and tagging', 'Guide and program sales volume', 'Consistent engagement on workout content', 'Cross-platform follower growth'],
  },
  'Editorial / High-Fashion Shoots': {
    vertical: 'Editorial / High-Fashion Shoots',
    audience: 'Fans who value beauty, artistry, and a curated visual experience — collectors and aesthetes.',
    contentPillars: ['Themed editorial photo sets', 'High-production styled shoots', 'Fashion and styling showcases', 'Artistic visual storytelling'],
    growthStrategies: ['Portfolio-quality social posts for discovery', 'Fashion community and hashtag positioning', 'Photographer and stylist collaborations', 'Seasonal editorial collections'],
    monetisationOpportunities: ['Premium set PPV', 'Limited-edition or numbered drops', 'Print and digital collectible sales', 'Bespoke custom sets'],
    retentionStrategies: ['Consistent editorial calendar', 'Behind-the-scenes production content', 'Exclusive subscriber-only sets', 'Collection and series narratives'],
    creatorChallenges: ['High production cost and time', 'Maintaining quality consistency', 'Slower content cadence', 'Narrower audience than casual formats'],
    successIndicators: ['High save and share rate on editorial posts', 'Premium PPV conversion', 'Brand and photographer collaboration inquiries', 'Subscriber loyalty on set drops'],
  },
  'Roleplay / Character Content': {
    vertical: 'Roleplay / Character Content',
    audience: 'Fans who seek immersive fantasy experiences and value character commitment and scenario craft.',
    contentPillars: ['Character-driven scenarios', 'Themed roleplay series', 'Fan-requested custom scenarios', 'Character development arcs'],
    growthStrategies: ['Character teasers for social discovery', 'Fandom tie-in characters', 'Collaboration roleplay with other creators', 'Interactive scenario polls'],
    monetisationOpportunities: ['Custom scenario commissions', 'Character-specific PPV', 'Tiered access to exclusive characters', 'Interactive choose-your-adventure formats'],
    retentionStrategies: ['Recurring character arcs', 'Fan-driven scenario input', 'Character unlocks at loyalty milestones', 'Season-style narrative structures'],
    creatorChallenges: ['Character maintenance and consistency', 'Costume and production overhead', 'Avoiding character fatigue', 'Balancing fan requests with creative direction'],
    successIndicators: ['High custom request volume', 'Fan engagement with character names and references', 'Series completion rate', 'Premium conversion on character PPV'],
  },
  'Cosy Authenticity': {
    vertical: 'Cosy Authenticity',
    audience: 'Fans seeking warmth, comfort, and a genuine low-key connection — the antidote to high-production glamour.',
    contentPillars: ['Casual, unfiltered daily moments', 'Comforting and warm aesthetic', 'Genuine conversation and check-ins', 'Low-production authentic content'],
    growthStrategies: ['Relatable, shareable casual clips', 'Authenticity as a differentiator', 'Community warmth and engagement', 'Consistent "cosy" brand aesthetic'],
    monetisationOpportunities: ['Intimate casual PPV', 'Personal check-in and DM upsells', 'Cosy themed bundles', 'Subscriber-only unfiltered content'],
    retentionStrategies: ['Daily or frequent casual check-ins', 'Warm community rituals', 'Fan-driven conversation topics', 'Consistent cosy aesthetic and schedule'],
    creatorChallenges: ['Perceived "low effort" devaluation', 'Maintaining authenticity as audience grows', 'Revenue ceiling from casual positioning', 'Difficulty commanding premium pricing'],
    successIndicators: ['High DM and comment engagement', 'Strong retention and low churn', 'Fan messages expressing comfort and connection', 'Consistent subscriber growth without paid promotion'],
  },
  'Tease & Deny': {
    vertical: 'Tease & Deny',
    audience: 'Fans driven by anticipation, mystery, and the thrill of the chase — they pay for the build-up.',
    contentPillars: ['Anticipation-building tease content', 'Reveal timing and pacing', 'Mystery and suggestion', 'Escalation and payoff cycles'],
    growthStrategies: ['Tease clips as social hooks', 'Anticipation-loop marketing', 'Scarcity and exclusivity framing', 'Progressive reveal series for conversion'],
    monetisationOpportunities: ['Reveal-gated PPV', 'Tip-to-unlock mechanics', 'Premium full-reveal tiers', 'Custom tease commissions'],
    retentionStrategies: ['Multi-stage reveal arcs', 'Recurring tease schedules', 'Escalation ladders across content tiers', 'Anticipation event countdowns'],
    creatorChallenges: ['Sustaining anticipation without frustrating fans', 'Pacing reveals to maintain value', 'Avoiding content that never delivers', 'Balancing tease with enough reward'],
    successIndicators: ['High PPV unlock rates on reveals', 'Strong tip activity on tease posts', 'Low refund/complaint rate on paid reveals', 'Fan messages expressing anticipation and excitement'],
  },
};

/**
 * Neutral fallback for verticals not in the registry.
 */
export const FALLBACK_VERTICAL_KNOWLEDGE: VerticalKnowledge = {
  vertical: 'Unspecified' as VerticalKey,
  audience: 'Audience not yet well defined — discovery and testing are the priority.',
  contentPillars: ['Exploratory content tests', 'A/B format experiments', 'Authentic baseline content'],
  growthStrategies: ['Test multiple formats and measure response', 'Observe what resonates and double down'],
  monetisationOpportunities: ['Experiment with offers to find natural revenue fit'],
  retentionStrategies: ['Consistent posting cadence', 'Fan feedback loops', 'Community building'],
  creatorChallenges: ['Lack of clear direction', 'Scattered effort', 'Slow traction'],
  successIndicators: ['Identifying a repeatable format', 'Consistent engagement on a content type', 'Fan requests clustering around a theme'],
};
