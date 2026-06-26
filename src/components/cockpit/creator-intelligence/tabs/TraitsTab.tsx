// ── Trait Engine Tab ──
// Sprint FYV-3.2A: placeholder.
// Implemented in FYV-3.2C.

import { useCreatorIntelligence } from '../context';

export function TraitsTab() {
  const { intelligence } = useCreatorIntelligence();
  const count = intelligence?.traits?.length ?? 0;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        {count} traits inferred from assessment responses. Expandable trait
        cards with confidence bars and supporting evidence will be displayed here.
      </p>
      <div className="rounded-lg border border-dashed border-gray-300 bg-surface-2 p-6 text-center text-sm text-gray-500">
        Implemented in FYV-3.2C
      </div>
    </div>
  );
}
