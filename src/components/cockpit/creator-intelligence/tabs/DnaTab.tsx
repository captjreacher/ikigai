// ── Creator DNA Tab ──
// Sprint FYV-3.2A: placeholder.
// Implemented in FYV-3.2C.

import { useCreatorIntelligence } from '../context';

export function DnaTab() {
  const { dnaProfiles } = useCreatorIntelligence();
  const dna = dnaProfiles[0];

  return (
    <div className="space-y-4">
      {dna ? (
        <p className="text-sm text-gray-600">
          Primary DNA: {dna.creator_dna_primary}. Expandable groups for
          Identity, Behaviour, Brand, and Commercial will be displayed here.
        </p>
      ) : (
        <p className="text-sm text-gray-600">
          No Creator DNA profile stored yet.
        </p>
      )}
      <div className="rounded-lg border border-dashed border-gray-300 bg-surface-2 p-6 text-center text-sm text-gray-500">
        Implemented in FYV-3.2C
      </div>
    </div>
  );
}
