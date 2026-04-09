// lib/semantic/index.ts
// Barrel public du module de détection sémantique — Phase 19 v1.3 Seed.
// Consommé (plus tard) par Phase 20 dispatcher applyTaskEffect() uniquement.
//
// IMPORTANT : ne PAS ré-exporter `normalize` (détail d'implémentation dans
// derive.ts) ni `CATEGORIES` (mapping interne). Les consommateurs n'ont besoin
// que de la fonction publique et des helpers flag.

export { deriveTaskCategory } from './derive';
export {
  isSemanticCouplingEnabled,
  setSemanticCouplingEnabled,
  SEMANTIC_COUPLING_KEY,
} from './flag';
export type {
  CategoryId,
  CategoryMatch,
  SemanticCategory,
} from './categories';

export { applyTaskEffect, EFFECT_GOLDEN_MULTIPLIER } from './effects';
export type { EffectId, EffectResult } from './effects';

// Phase 20 — caps anti-abus
export {
  loadCaps,
  saveCaps,
  isCapExceeded,
  incrementCap,
  getWeekStart,
  DAILY_CAPS,
  WEEKLY_CAPS,
} from './caps';
export type { CouplingCaps, EffectCap } from './caps';

// Phase 21 — feedback visuel + compagnon
export { EFFECT_TOASTS, CATEGORY_VARIANT, CATEGORY_HAPTIC_FN } from './effect-toasts';
export type { EffectToastDef, HarvestBurstVariant } from './effect-toasts';
