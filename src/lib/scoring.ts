import type {
  AssessmentResponses,
  CreatorArchetype,
  ContentVertical,
  ManagementReadiness,
  ReportData,
} from '@/types/creator';

export interface ScoreBreakdown {
  creator_dna: number;
  brand_clarity: number;
  monetisation: number;
  consistency: number;
  agency_opportunity: number;
}

export interface ScoringResult {
  scores: ScoreBreakdown;
  archetype: CreatorArchetype;
  archetype_description: string;
  archetype_strengths: string[];
  archetype_risks: string[];
  archetype_growth: string[];
  top_verticals: { name: ContentVertical; rationale: string }[];
  management_readiness: ManagementReadiness;
  pricing_strategy: string;
  winning_10_framework: string;
  growth_strategy: string;
  tech_stack: { tool: string; purpose: string }[];
  day_90_plan: { phase: string; focus: string; actions: string[] }[];
}

// ── Score Computation ──

function computeCreatorDNA(r: AssessmentResponses): number {
  let score = 50;
  score += r.comfort_level * 3; // 1-10 → +3 to +30
  if (r.strengths.includes('Humor')) score += 10;
  if (r.strengths.includes('Dancing')) score += 8;
  if (r.strengths.includes('Public Speaking')) score += 10;
  if (r.strengths.includes('High-Energy')) score += 8;
  score += Math.min((r.fantasy_keywords?.split(',').length ?? 0) * 2, 10);
  return Math.min(100, Math.max(0, score));
}

function computeBrandClarity(r: AssessmentResponses): number {
  let score = 40;
  if (r.persona_occupation && r.persona_occupation !== 'other') score += 15;
  if (r.niche_interests.length >= 2) score += 12;
  else if (r.niche_interests.length === 1) score += 6;
  if (r.nudity_level !== 'undecided') score += 10;
  if (r.fantasy_keywords && r.fantasy_keywords.length > 0) score += 8;
  if (r.strengths.includes('Specialized Knowledge/Astrology')) score += 10;
  return Math.min(100, Math.max(0, score));
}

function computeMonetisation(r: AssessmentResponses): number {
  let score = 30;
  if (r.audience_target === 'whales') score += 20;
  else score += 10;
  if (r.parasocial_comfort) score += 15;
  if (r.nudity_level === 'full_nude' || r.nudity_level === 'fetish') score += 15;
  else if (r.nudity_level === 'topless') score += 10;
  if (r.niche_interests.includes('Roleplay') || r.niche_interests.includes('Daddy dynamic')) score += 10;
  if (r.comfort_level >= 7) score += 10;
  return Math.min(100, Math.max(0, score));
}

function computeConsistency(r: AssessmentResponses): number {
  let score = 50;
  if (r.strengths.includes('High-Energy')) score += 15;
  if (r.passion_topic && r.passion_topic.length > 20) score += 10;
  if (r.persona_occupation && r.persona_occupation !== 'other') score += 10;
  if (r.audience_target === 'masses') score += 10;
  if (r.consent) score += 5;
  return Math.min(100, Math.max(0, score));
}

function computeAgencyOpportunity(r: AssessmentResponses, scores: ScoreBreakdown): number {
  const avg = (scores.creator_dna + scores.brand_clarity + scores.monetisation + scores.consistency) / 4;
  let score = Math.round(avg * 0.7);
  if (r.consent) score += 10;
  if (r.audience_target === 'whales') score += 8;
  if (r.comfort_level >= 7) score += 7;
  if (r.strengths.length >= 3) score += 5;
  return Math.min(100, Math.max(0, score));
}

// ── Archetype Engine ──

const ARCHETYPE_MAP: Record<string, CreatorArchetype> = {
  'Cozy,Aesthetic/Cozy': 'Girl Next Door',
  'High-Energy,Public Speaking': 'Corporate Rebel',
  'Fitness/Muscle,Specific Sport': 'Fitness Tease',
  'Roleplay,Fetish-specific': 'Alternative Fantasy',
  'Specialized Knowledge/Astrology,Public Speaking': 'Intellectual Seductress',
  'High-Energy,Humor': 'Chaos Gremlin',
  'High-Fashion,Full Nude': 'Luxury Muse',
  'Cozy,Roleplay': 'Soft-Girl Companion',
};

const ARCHETYPE_DETAILS: Record<CreatorArchetype, Omit<ReportData, 'scores' | 'top_verticals' | 'pricing_strategy' | 'winning_10_framework' | 'growth_strategy' | 'tech_stack' | 'management_readiness' | 'day_90_plan'>> = {
  'Girl Next Door': {
    archetype: 'Girl Next Door',
    archetype_description: 'Authentic, relatable, approachable — the creator next door who builds deep parasocial trust through everyday intimacy and cosy content.',
    archetype_strengths: ['Authenticity-driven engagement', 'High trust & loyalty from fans', 'Broad audience appeal', 'Low-stakes content production'],
    archetype_risks: ['Oversaturation of niche', 'Burnout from constant parasocial demands', 'Difficulty commanding premium pricing'],
    archetype_growth: ['Leverage cosy content into lifestyle partnerships', 'Build a private story / VIP tier for superfans', 'Expand into adjacent platforms (TikTok, YouTube)'],
  },
  'Luxury Muse': {
    archetype: 'Luxury Muse',
    archetype_description: 'Aspirational, exclusive, high-end — the creator whose content feels like a luxury brand experience.',
    archetype_strengths: ['Premium pricing power', 'Brand partnership potential', 'Low volume, high revenue model', 'Luxury brand alignment'],
    archetype_risks: ['Smaller total addressable audience', 'Content must maintain high production value', 'Alienating casual subscribers'],
    archetype_growth: ['Pursue luxury brand sponsorships', 'Create exclusive high-ticket PPV content', 'Build referral networks among high-net-worth fans'],
  },
  'Corporate Rebel': {
    archetype: 'Corporate Rebel',
    archetype_description: 'Bold, provocative, anti-establishment — the creator who leverages professional expertise or corporate disillusionment into compelling content.',
    archetype_strengths: ['Strong narrative hook', 'Polarizing content drives engagement', 'Day-to-night duality is compelling', 'Authority + rebellion dynamic'],
    archetype_risks: ['Risk of real-world professional consequences', 'Niche may not scale indefinitely', 'Polarization can limit brand deals'],
    archetype_growth: ['Build storytime content around workplace themes', 'Develop professional empowerment adjacent products', 'Leverage LinkedIn + OF crossover novelty'],
  },
  'Fitness Tease': {
    archetype: 'Fitness Tease',
    archetype_description: 'Athletic, disciplined, body-positive — the creator whose fitness journey is the primary content engine.',
    archetype_strengths: ['Built-in content format (workouts)', 'High post frequency potential', 'Health & wellness brand partnerships', 'Visual progress = natural content hooks'],
    archetype_risks: ['Body-image pressure', 'Niche ceiling without evolving content', 'Platform policy risk with athletic wear vs nudity'],
    archetype_growth: ['Launch fitness programs or coaching upsells', 'Partner with athleisure and supplement brands', 'Build community challenges for engagement loops'],
  },
  'Alternative Fantasy': {
    archetype: 'Alternative Fantasy',
    archetype_description: 'Edgy, niche, subculture-driven — the creator who dominates a specific fantasy or fetish vertical with creative authority.',
    archetype_strengths: ['Deep niche loyalty', 'High PPV conversion', 'Low direct competition', 'Creative freedom within niche'],
    archetype_risks: ['Niche ceiling', 'Platform policy sensitivity', 'Difficult to pivot to mainstream'],
    archetype_growth: ['Own the niche — become the definitive creator in the category', 'Build custom content menu for tiered access', 'Cross-promote to adjacent subculture communities'],
  },
  'Soft-Girl Companion': {
    archetype: 'Soft-Girl Companion',
    archetype_description: 'Gentle, nurturing, emotionally intelligent — the creator who provides comfort, companionship, and soft intimacy through content.',
    archetype_strengths: ['Deep emotional connection with fans', 'Very high retention rates', 'GFE (Girlfriend Experience) premium upsells', 'Safe-for-work crossover potential'],
    archetype_risks: ['Emotional labor burnout', 'Boundary management with parasocial fans', 'Harder to scale to large volume'],
    archetype_growth: ['Build a cozy Patreon/Substack layer', 'Develop ASMR/comfort audio content', 'Create tiered GFE packages with clear boundaries'],
  },
  'Intellectual Seductress': {
    archetype: 'Intellectual Seductress',
    archetype_description: 'Smart, sophisticated, education-first — the creator who monetizes specialized knowledge wrapped in seductive presentation.',
    archetype_strengths: ['Unique market positioning', 'High-value audience (educated, high-income)', 'Content is inherently educational = YouTube/Spotify crossover', 'Thought leadership potential'],
    archetype_risks: ['Niche velocity — need consistent hot takes', 'May alienate fans seeking pure entertainment', 'Content requires research/preparation'],
    archetype_growth: ['Launch a podcast or YouTube channel', 'Develop paid courses or workshops', 'Build expert panel / debate content for viral reach'],
  },
  'Chaos Gremlin': {
    archetype: 'Chaos Gremlin',
    archetype_description: 'Unpredictable, hilarious, chaos-maxxing — the creator whose personality is the product and whose content thrives on spontaneity.',
    archetype_strengths: ['Highly shareable content', 'Fast audience growth potential', 'Personality-driven = hard to replicate', 'Natural viral hook generator'],
    archetype_risks: ['Inconsistent output', 'Reputation / brand safety risk', 'Harder to convert to premium revenue', 'Potential burnout from being always-on'],
    archetype_growth: ['Systematize chaos — capture spontaneous moments with structure', 'Build a highlights / best-of subscription tier', 'Partner with brands seeking edgy / authentic voice'],
  },
};

function determineArchetype(r: AssessmentResponses): CreatorArchetype {
  const keys: string[] = [];
  if (r.strengths.includes('Cozy') || r.strengths.includes('Aesthetic/Cozy')) keys.push('Cozy,Aesthetic/Cozy');
  if (r.strengths.includes('High-Energy') && r.strengths.includes('Public Speaking')) keys.push('High-Energy,Public Speaking');
  if (r.niche_interests.includes('Fitness/Muscle') || r.strengths.includes('Specific Sport')) keys.push('Fitness/Muscle,Specific Sport');
  if (r.niche_interests.includes('Roleplay') || r.nudity_level === 'fetish') keys.push('Roleplay,Fetish-specific');
  if (r.strengths.includes('Specialized Knowledge/Astrology') && r.strengths.includes('Public Speaking')) keys.push('Specialized Knowledge/Astrology,Public Speaking');
  if (r.strengths.includes('High-Energy') && r.strengths.includes('Humor')) keys.push('High-Energy,Humor');
  if (r.niche_interests.includes('High-Fashion') && r.nudity_level === 'full_nude') keys.push('High-Fashion,Full Nude');
  if ((r.strengths.includes('Cozy') || r.strengths.includes('Aesthetic/Cozy')) && r.niche_interests.includes('Roleplay')) keys.push('Cozy,Roleplay');

  for (const k of keys) {
    if (ARCHETYPE_MAP[k]) return ARCHETYPE_MAP[k];
  }
  // Fallback: use strengths to guess
  if (r.strengths.includes('Humor')) return 'Chaos Gremlin';
  if (r.strengths.includes('Specialized Knowledge/Astrology')) return 'Intellectual Seductress';
  if (r.niche_interests.includes('Fitness/Muscle')) return 'Fitness Tease';
  if (r.nudity_level === 'sfw_only' || r.nudity_level === 'teasing_only') return 'Girl Next Door';
  if (r.nudity_level === 'full_nude') return 'Luxury Muse';
  return 'Chaos Gremlin';
}

// ── Content Vertical Engine ──

function determineVerticals(r: AssessmentResponses, archetype: CreatorArchetype): { name: ContentVertical; rationale: string }[] {
  const results: { name: ContentVertical; rationale: string }[] = [];

  if (r.strengths.includes('Specific Sport') && r.comfort_level >= 5) {
    results.push({ name: 'Skill-Based Challenges', rationale: 'Sport ability + camera confidence = high-engagement challenge content (e.g. Crossbar Challenge, trick shot multiplication)' });
  }
  if (r.strengths.includes('Specialized Knowledge/Astrology') && r.strengths.includes('High-Energy')) {
    results.push({ name: 'Polarizing Storytimes', rationale: 'Knowledge + energy = debate-sparking storytime content that drives algorithm-friendly comment sections' });
  }
  if ((r.strengths.includes('Cozy') || r.strengths.includes('Aesthetic/Cozy')) && (r.nudity_level === 'sfw_only' || r.nudity_level === 'teasing_only')) {
    results.push({ name: 'Lifestyle Vlogging / GRWM', rationale: 'Cosy aesthetic + teasing boundary = Girl Next Door authenticity through Get-Ready-With-Me and lifestyle content' });
  }
  if (r.strengths.includes('Humor') && r.comfort_level >= 6) {
    results.push({ name: 'Comedy Skits', rationale: 'Comedy + camera comfort = skit content with high shareability and viral potential on TikTok/Reels' });
  }
  if (r.parasocial_comfort && r.passion_topic && r.passion_topic.length > 10) {
    results.push({ name: 'Confessional Storytime', rationale: 'Parasocial comfort + deep passion topic = intimate confessional content that builds superfan loyalty' });
  }
  if (r.niche_interests.includes('Fitness/Muscle') || r.strengths.includes('Specific Sport')) {
    results.push({ name: 'Fitness Journey', rationale: 'Fitness/muscle niche = visual transformation content with built-in progression hooks and brand opportunities' });
  }
  if (r.niche_interests.includes('High-Fashion') || archetype === 'Luxury Muse') {
    results.push({ name: 'Editorial / High-Fashion Shoots', rationale: 'Fashion interest + luxury positioning = editorial-quality shoots that command premium pricing' });
  }
  if (r.niche_interests.includes('Roleplay') || archetype === 'Alternative Fantasy' || archetype === 'Soft-Girl Companion') {
    results.push({ name: 'Roleplay / Character Content', rationale: 'Roleplay interest + fantasy niche = character-driven content that creates reusable IP and deepens fetish authority' });
  }
  if ((r.strengths.includes('Cozy') || r.strengths.includes('Aesthetic/Cozy')) && results.length < 3) {
    results.push({ name: 'Cosy Authenticity', rationale: 'Cosy strength = comfort-audience content that feels intimate and unfiltered, driving retention' });
  }

  // Ensure we have at least 3
  const fallbacks: { name: ContentVertical; rationale: string }[] = [
    { name: 'Tease & Deny', rationale: 'Universal vertical — build anticipation through countdowns, previews, and limited-time unlocks that gamify the fan experience' },
    { name: 'Confessional Storytime', rationale: 'Share personal stories to build emotional connection and parasocial investment from your audience' },
    { name: 'Lifestyle Vlogging / GRWM', rationale: 'Document your daily routine to build authenticity and trust with your subscriber base' },
  ];
  for (const fb of fallbacks) {
    if (results.length >= 3) break;
    if (!results.some(r => r.name === fb.name)) {
      results.push(fb);
    }
  }
  return results.slice(0, 3);
}

// ── Management Readiness ──

function determineReadiness(r: AssessmentResponses, scores: ScoreBreakdown): ManagementReadiness {
  const avg = (scores.agency_opportunity + scores.consistency + scores.brand_clarity) / 3;
  if (avg >= 70 && scores.agency_opportunity >= 65 && r.consent) return 'Scale Candidate';
  if (avg >= 55 && r.comfort_level >= 5) return 'Ready Now';
  if (avg >= 35) return 'Needs Foundation';
  return 'Hobby Creator';
}

// ── Day 90 Plan ──

function generatePlan(readiness: ManagementReadiness, topVerticals: { name: ContentVertical; rationale: string }[]): { phase: string; focus: string; actions: string[] }[] {
  const vNames = topVerticals.map(v => v.name);
  const base: { phase: string; focus: string; actions: string[] }[] = [
    { phase: 'Days 1-30: Foundation', focus: 'Content audit, setup, and first tests',
      actions: ['Set up content calendar in Notion', 'Film 5 variations of top vertical: ' + vNames[0], 'Post 2x daily on TikTok/Reels for 30 days', 'Set up Inflow CRM for subscriber management', 'Define your content pillars and posting schedule'] },
    { phase: 'Days 31-60: Multiplication', focus: 'Scale what works',
      actions: ['Identify first 10 viral hooks using the Winning 10 Framework', 'Create 200 variations of your best-performing hook', 'A/B test thumbnails, captions, and posting times', 'Launch premium tier or PPV content', 'Begin 1-on-1 DM strategy for whale conversion'] },
    { phase: 'Days 61-90: Optimization', focus: 'Refine, automate, grow',
      actions: ['Audit top-performing content from Days 1-60', 'Set up AI-assisted chatting (SuperCreator/Luna)', 'Establish recurring content formats (weekly series)', 'Plan first collaboration or cross-promotion', 'Review pricing and adjust based on conversion data'] },
  ];
  if (readiness === 'Scale Candidate') {
    base[2].actions.push('Onboard agency management for operational scale');
    base[2].actions.push('Begin scouting second creator for portfolio expansion');
  }
  if (readiness === 'Needs Foundation' || readiness === 'Hobby Creator') {
    base[0].actions.unshift('Focus on camera comfort — film 30 seconds daily, no pressure to post');
    base[0].actions.unshift('Define your creator persona in 3 sentences');
  }
  return base;
}

// ── Main Scoring Function ──

export function scoreAssessment(r: AssessmentResponses): ScoringResult {
  const creator_dna = computeCreatorDNA(r);
  const brand_clarity = computeBrandClarity(r);
  const monetisation = computeMonetisation(r);
  const consistency = computeConsistency(r);
  const agency_opportunity = computeAgencyOpportunity(r, { creator_dna, brand_clarity, monetisation, consistency } as ScoreBreakdown);
  const archetype = determineArchetype(r);
  const details = ARCHETYPE_DETAILS[archetype];
  const top_verticals = determineVerticals(r, archetype);
  const management_readiness = determineReadiness(r, { creator_dna, brand_clarity, monetisation, consistency, agency_opportunity } as ScoreBreakdown);

  const pricing_strategy = r.audience_target === 'whales'
    ? 'Premium Paid Page ($20-50/month) — low volume, high revenue per subscriber. Include tiered DMs and 1-on-1 personalized chatting for top fans. Focus on exclusivity and luxury positioning.'
    : 'Volume Freemium ($0-10/month) — high subscriber count, monetize through PPV and tips. Use free page as top-of-funnel, upsell custom content and premium tiers. Run frequent promos and bundles.';

  return {
    scores: { creator_dna, brand_clarity, monetisation, consistency, agency_opportunity },
    archetype,
    archetype_description: details.archetype_description,
    archetype_strengths: details.archetype_strengths,
    archetype_risks: details.archetype_risks,
    archetype_growth: details.archetype_growth,
    top_verticals,
    management_readiness,
    pricing_strategy,
    winning_10_framework: 'The Winning 10 Framework: (1) Identify your first viral hook — the one format that outperforms all others. (2) Extract the core elements: hook, structure, payoff. (3) Create 10 variations with different contexts, locations, outfits, or angles. (4) Post all 10 across 10 days on TikTok/Reels. (5) Measure: which variation had the highest engagement? (6) Create 200 more variations of the winner. This is the Multiplication Phase — one hook, infinite angles, exponential growth.',
    growth_strategy: 'Deploy "Viral Billboards" — short-form content on TikTok and Reels that serves as free acquisition. Every post is a billboard for your OnlyFans storefront. Follow the 80/20 rule: 80% discoverable content (trends, hooks, value), 20% direct calls-to-action to your OF link. Build a "hook library" of 50+ proven openers and cycle them. Post minimum 2x daily. Use trending audio. Respond to every comment for the first hour after posting (algorithm boost).',
    tech_stack: [
      { tool: 'Inflow', purpose: 'CRM — subscriber management, segmentation, and lifecycle tracking' },
      { tool: 'SuperCreator or Luna', purpose: 'AI-assisted chatting — warm subscribers, automate FAQs, identify whales' },
      { tool: 'Notion', purpose: 'Content calendar, SOPs, idea bank, and collaboration workspace' },
      { tool: 'Canva Pro', purpose: 'Thumbnails, promotional graphics, and visual branding' },
    ],
    day_90_plan: generatePlan(management_readiness, top_verticals),
  };
}

export function generateReportSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${slug}-${suffix}`;
}
