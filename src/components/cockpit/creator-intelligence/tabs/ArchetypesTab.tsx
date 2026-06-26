// ── Archetype Engine Tab ──
// Sprint FYV-3.2A: placeholder.
// Implemented in FYV-3.2C.

import { useCreatorIntelligence } from '../context';

export function ArchetypesTab() {
  const { intelligence } = useCreatorIntelligence();
  const count = intelligence?.archetype_fits?.length ?? 0;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        {count} archetype fits computed. A sidebar with archetype cards and a
        detail panel showing supporting/contradicting evidence will be displayed here.
      </p>
      <div className="rounded-lg border border-dashed border-gray-300 bg-surface-2 p-6 text-center text-sm text-gray-500">
        Implemented in FYV-3.2C
      </div>
    </div>
  );
}
