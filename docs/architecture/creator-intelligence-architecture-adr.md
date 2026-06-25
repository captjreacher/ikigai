# Creator Intelligence Architecture ADR

## Status

Accepted for Sprint FYV-3.0.

## Context

Find Your Vertical previously treated assessment answers as direct inputs to report scores and report copy. That made the public wizard, scoring logic, and report presentation too tightly coupled. The platform now needs to support multiple report products from the same creator profile without re-asking or re-scoring the creator differently for each output.

## Decision

Creator DNA is the canonical profile model. Assessment answers are converted into evidence, evidence is weighted into traits, traits are composed into Creator DNA, and reports are generated as presentation views over the same DNA.

The required flow is:

```text
Question -> Evidence -> Traits -> Creator DNA -> Scores -> Report Templates
```

The wizard may collect answers and conditional metadata, but it must not contain final report scoring logic. Report tiers are selected as generation configuration:

- `free`
- `premium`
- `agency`

## Architecture

### Question Layer

Questions collect structured answers. Each question may include metadata describing:

- the evidence dimensions it can produce
- trait targets it may inform
- archetype hypotheses it may validate
- conditional display rules
- scenario ranking or validation behavior

Questions are not allowed to own final score outcomes.

### Evidence Layer

Evidence is the normalized interpretation of an answer. A single answer can produce multiple evidence signals. Evidence records include source question, dimension, polarity, strength, confidence, and optional archetype validation context.

### Trait Layer

Traits aggregate evidence across the whole assessment. Trait weights are additive, explainable, and separate from report presentation. Traits include positioning clarity, visibility comfort, social energy, authenticity, monetisation readiness, consistency, body confidence, fan connection, coachability, and risk.

### Creator DNA Layer

Creator DNA is the canonical profile. It includes primary and secondary creator motivations, archetype fit, confidence, authenticity flags, growth constraints, monetisation readiness, and agency opportunity signals.

### Score Projection Layer

Scores are projections from Creator DNA and trait strength. The same Creator DNA can produce different score sets for different contexts, but the underlying DNA remains stable.

### Report Template Layer

Reports are presentation views only.

- Free report: brief DNA summary, primary archetype, top vertical, headline scores, one recommendation, upsell CTA.
- Premium report: full interpretation, score reasoning, confidence explanation, content opportunities, monetisation pathway, 90-day action plan.
- Agency report: internal coachability, management fit, growth potential, risk indicators, services, follow-up priority.

## Consequences

- New assessment versions can add validation questions without changing report UI.
- Archetype selection becomes a hypothesis to validate, not a final answer.
- Internal agency outputs can become richer without exposing internal judgement to public reports.
- Existing public assessment and report generation continue to work through compatibility builders.

## Non-Goals

- No visual redesign in this sprint.
- No replacement of existing Supabase persistence tables beyond report-tier compatibility.
- No hard-coded report copy inside the assessment wizard.
