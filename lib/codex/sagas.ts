// lib/codex/sagas.ts — Sagas immersives (source: SAGAS)
//
// Dérive les entrées codex depuis SAGAS (lib/mascot/sagas-content.ts).
// 4 sagas : voyageur_argent, source_cachee, carnaval_ombres, graine_anciens.

import { SAGAS } from '../mascot/sagas-content';
import type { SagaEntry } from './types';

export const sagaEntries: SagaEntry[] = SAGAS.map((s) => ({
  id: `saga_${String(s.id)}`,
  kind: 'saga' as const,
  sourceId: String(s.id),
  nameKey: `codex.saga.${String(s.id)}.name`,
  loreKey: `codex.saga.${String(s.id)}.lore`,
}));
