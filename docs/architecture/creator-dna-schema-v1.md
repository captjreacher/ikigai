# Creator DNA Schema v1

## Canonical Model

Creator DNA is the durable profile inferred from assessment evidence. Reports, dashboards, and agency workflows read from Creator DNA rather than directly from raw answers.

## Type Shape

```ts
type CreatorDnaProfile = {
  creator_profile_id: string;
  assessment_id: string;
  creator_dna_primary: string;
  creator_dna_secondary: string;
  confidence: number;
  fantasy_archetype: string;
  archetype_confidence: number;
  authenticity_band: 'High Authenticity' | 'Moderate Authenticity' | 'Potential Conflict';
  authenticity_flags: string[];
  growth_constraints: string[];
  monetisation_readiness: 'Low' | 'Developing' | 'Ready' | 'Advanced';
  agency_opportunity_score: number;
  agency_opportunity_band: 'High Priority' | 'Qualified' | 'Needs Development' | 'Not Suitable Yet';
  summary: string;
};
```

## Evidence

Evidence records are normalized answer signals.

```ts
type AssessmentEvidence = {
  id: string;
  source_question_key: string;
  response_key: string;
  section: AssessmentV2Section;
  dimension: EvidenceDimension;
  value: string | number | boolean | string[];
  strength: number;
  polarity: 'positive' | 'negative' | 'neutral';
  confidence: number;
  validates_archetype?: string;
  tags: string[];
};
```

## Trait Weights

Traits are inferred from evidence. Weights are explainable and may be audited.

```ts
type TraitWeight = {
  trait: CreatorTrait;
  weight: number;
  evidence_ids: string[];
  rationale: string;
};
```

Initial trait families:

- visibility comfort
- social energy
- authenticity
- emotional familiarity
- trust building
- body confidence
- routine discipline
- visual discipline
- monetisation fit
- positioning clarity
- fan connection
- coachability
- risk awareness

## Archetype Fit

Archetypes are scored as hypotheses with supporting and contradicting evidence.

```ts
type ArchetypeFit = {
  archetype: string;
  fit_score: number;
  confidence: number;
  selected_by_creator: boolean;
  validation_status: 'selected_only' | 'validated' | 'contradicted' | 'inferred';
  supporting_evidence_ids: string[];
  contradicting_evidence_ids: string[];
};
```

Creator-selected archetypes start as `selected_only`. Later scenario questions can validate or contradict them.

## Confidence

Confidence is based on:

- quantity and diversity of evidence
- agreement between explicit selection and behavioral/scenario answers
- score spread between competing archetypes
- contradictions in boundaries, goals, and positioning
- completion quality and answer specificity

## Report Projections

Scores are projections from Creator DNA and traits:

- Creator DNA score
- Brand clarity score
- Monetisation score
- Consistency score
- Agency opportunity score

Reports do not own these scores. They select which projections and explanations to display.
