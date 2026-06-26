// ── Evidence Tab ──
// Sprint FYV-3.2A: placeholder.
// Implemented in FYV-3.2B.

import { useCreatorIntelligence } from '../context';

export function EvidenceTab() {
  const { intelligence } = useCreatorIntelligence();
  const count = intelligence?.evidence?.length ?? 0;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        {count} evidence signals extracted from the assessment. Evidence cards
        will be displayed here, grouped by dimension.
      </p>
      <div className="rounded-lg border border-dashed border-gray-300 bg-surface-2 p-6 text-center text-sm text-gray-500">
        Implemented in FYV-3.2B
      </div>
    </div>
  );
}
