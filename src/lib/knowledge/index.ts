// ─────────────────────────────────────────────────────────────────────────────
// Creator Intelligence — Knowledge Registry: Barrel Export (Sprint FYV-3.4A)
//
// Clean public surface for the knowledge registry.
//
// Usage (when wired in by a future sprint):
//   import { getArchetypeKnowledge, getVerticalKnowledge, getAudienceKnowledge }
//     from '@/lib/knowledge';
//   import type { ArchetypeKnowledge, KnowledgeRegistry } from '@/lib/knowledge';
// ─────────────────────────────────────────────────────────────────────────────

// Types
export type {
  ArchetypeKnowledge,
  AudienceKnowledge,
  AudienceProfileKey,
  KnowledgeRegistry,
  VerticalKey,
  VerticalKnowledge,
} from './types';

// Data
export { ARCHETYPE_KNOWLEDGE, FALLBACK_ARCHETYPE_KNOWLEDGE } from './archetypes';
export { VERTICAL_KNOWLEDGE, FALLBACK_VERTICAL_KNOWLEDGE } from './verticals';
export { AUDIENCE_KNOWLEDGE } from './audiences';

// Registry and safe-fallback getters
export {
  knowledgeRegistry,
  getArchetypeKnowledge,
  getVerticalKnowledge,
  getAudienceKnowledge,
} from './registry';
