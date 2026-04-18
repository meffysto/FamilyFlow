// lib/codex/sagas.ts — Sagas immersives (source: SAGAS)
//
// Dérive les entrées codex depuis SAGAS (lib/mascot/sagas-content.ts).
// 4 sagas : voyageur_argent, source_cachee, carnaval_ombres, graine_anciens.
//
// Sprites visiteurs — même mapping que app/(tabs)/tree.tsx
// VISITOR_IDLE_FRAMES et components/mascot/VisitorSlot.tsx SAGA_SPRITES.
// Chaque saga a un avatar visiteur unique qui apparaît sur la ferme
// pendant l'événement.

import { SAGAS } from '../mascot/sagas-content';
import type { SagaEntry } from './types';

const SAGA_SPRITES: Record<string, unknown> = {
  voyageur_argent: require('../../assets/garden/animals/voyageur/idle_1.png'),
  source_cachee:   require('../../assets/garden/animals/esprit_eau/idle_1.png'),
  carnaval_ombres: require('../../assets/garden/animals/masque_ombre/idle_1.png'),
  graine_anciens:  require('../../assets/garden/animals/ancien_gardien/idle_1.png'),
};

export const sagaEntries: SagaEntry[] = SAGAS.map((s) => ({
  id: `saga_${String(s.id)}`,
  kind: 'saga' as const,
  sourceId: String(s.id),
  nameKey: `codex.saga.${String(s.id)}.name`,
  loreKey: `codex.saga.${String(s.id)}.lore`,
  spriteRef: SAGA_SPRITES[String(s.id)],
}));
