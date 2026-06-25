# Assessment Blueprint v2

## Principle

Assessment v2 collects evidence for Creator DNA. Questions do not map directly to final report scores.

## Sections

1. Identity
2. Positioning
3. Audience
4. Content Engine
5. Commercial Readiness
6. Growth Potential
7. Future Vision

## Question Metadata

Every v2 question should be able to carry metadata in `config`:

```json
{
  "evidence": {
    "dimensions": ["positioning", "confidence"],
    "traits": ["visibility_comfort", "positioning_clarity"],
    "archetypeHypotheses": ["Party Girl"],
    "validationMode": "scenario_rank"
  },
  "conditional": {
    "dependsOn": "persona_occupation",
    "operator": "includes_any",
    "value": ["Party Girl", "Fitness Goddess"]
  }
}
```

Legacy `parent_question_key`, `show_when_value`, and `show_when_operator` remain supported.

## Adaptive Questioning

Creator-selected archetypes are hypotheses. Later questions should validate them through scenarios.

### Party Girl Validation

Validate:

- nightlife comfort
- high visibility
- confidence under attention
- social energy
- nudity or tease comfort
- monetisation fit for party/lifestyle content

Example scenario prompt:

Rank the content concepts you would most naturally sustain:

- filming a nightlife recap and teasing behind-the-scenes access
- hosting a confident livestream before going out
- selling private party-themed content bundles
- keeping content soft and low-visibility

### Girl Next Door Validation

Validate:

- authenticity
- emotional familiarity
- trust
- relatability
- private fan connection

Example scenario prompt:

Rank the fan experiences that feel most natural:

- daily-life voice notes and casual updates
- private check-ins with loyal fans
- honest storytime content
- highly polished aspirational shoots

### Fitness Validation

Validate:

- body confidence
- routine
- progress tracking
- visual discipline
- lifestyle content sustainability

Example scenario prompt:

Rank the content systems you could repeat weekly:

- workout progress clips
- body-confidence check-ins
- routine-based lifestyle updates
- transformation or challenge content

## Report Tiers

### Free

- brief Creator DNA summary
- primary archetype
- top vertical
- headline scores
- one recommendation
- upsell CTA

### Premium

- full interpretation
- score reasoning
- confidence explanation
- content opportunities
- monetisation pathway
- 90-day action plan

### Agency

- internal only
- coachability
- management fit
- growth potential
- risk indicators
- recommended services
- follow-up priority

## Compatibility

Current public assessment routes keep working by converting existing answers into v2 evidence. New v2 templates should use the seven-section structure and add conditional scenario questions over time.
