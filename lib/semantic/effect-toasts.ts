// lib/semantic/effect-toasts.ts
// Dictionnaire des feedbacks toast + mappings catégorie → variant HarvestBurst + haptic.
// Phase 21 — feedback-visuel-compagnon.
// Module pur : zéro import vault/hook.

import type { CategoryId } from './categories';
import {
  hapticsEffectLight,
  hapticsEffectMedium,
  hapticsEffectStrong,
  hapticsEffectGolden,
} from '../mascot/haptics';

// ── Types ──────────────────────────────────────

export interface EffectToastDef {
  icon: string;
  fr: string;
  en: string;
  subtitle_fr: string;
  subtitle_en: string;
  type: 'success' | 'info';
}

export type HarvestBurstVariant = 'ambient' | 'rare' | 'golden';

// ── Dictionnaire des 10 toasts sémantiques ────

/**
 * EFFECT_TOASTS — 10 entrées, une par CategoryId.
 * Aligné 1:1 avec EFFECTS-01..10 (Phase 20) et UI-SPEC Toast Design Contract.
 */
export const EFFECT_TOASTS: Record<CategoryId, EffectToastDef> = {
  menage_quotidien: {
    icon: '🌿',
    fr: 'Ménage : mauvaises herbes retirées !',
    en: 'Housework: weeds removed!',
    subtitle_fr: 'Ferme plus propre',
    subtitle_en: 'Cleaner farm',
    type: 'success',
  },
  menage_hebdo: {
    icon: '🔧',
    fr: 'Grand ménage : usure réparée !',
    en: 'Deep clean: wear repaired!',
    subtitle_fr: 'Ferme comme neuve',
    subtitle_en: 'Farm like new',
    type: 'success',
  },
  courses: {
    icon: '🚀',
    fr: 'Courses faites : turbo bâtiments 24h !',
    en: 'Shopping done: building turbo 24h!',
    subtitle_fr: 'Production ×2',
    subtitle_en: 'Production ×2',
    type: 'success',
  },
  enfants_routines: {
    icon: '💛',
    fr: 'Routines enfants : compagnon heureux !',
    en: 'Child routines: happy companion!',
    subtitle_fr: 'Humeur au max',
    subtitle_en: 'Mood maxed',
    type: 'success',
  },
  enfants_devoirs: {
    icon: '📚',
    fr: 'Devoirs : sprint de croissance activé !',
    en: 'Homework: growth sprint active!',
    subtitle_fr: 'Stade plus vite',
    subtitle_en: 'Faster growth',
    type: 'info',
  },
  rendez_vous: {
    icon: '💎',
    fr: 'Rendez-vous : graine rare obtenue !',
    en: 'Appointment: rare seed earned!',
    subtitle_fr: 'Récolte précieuse',
    subtitle_en: 'Precious harvest',
    type: 'success',
  },
  gratitude_famille: {
    icon: '✨',
    fr: 'Gratitude : trait de saga boosté !',
    en: 'Gratitude: saga trait boosted!',
    subtitle_fr: 'Voyageur renforcé',
    subtitle_en: 'Traveler empowered',
    type: 'info',
  },
  budget_admin: {
    icon: '🏦',
    fr: 'Budget réglé : capacité ×2 pendant 24h !',
    en: 'Budget done: capacity ×2 for 24h!',
    subtitle_fr: 'Bâtiments pleins vite',
    subtitle_en: 'Buildings fill fast',
    type: 'success',
  },
  bebe_soins: {
    icon: '🌟',
    fr: 'Soins bébé : récolte dorée ×3 !',
    en: 'Baby care: golden harvest ×3!',
    subtitle_fr: 'Prochaine récolte épique',
    subtitle_en: 'Next harvest epic',
    type: 'success',
  },
  cuisine_repas: {
    icon: '🍳',
    fr: 'Repas préparé : recette rare débloquée !',
    en: 'Meal done: rare recipe unlocked!',
    subtitle_fr: 'Nouveau craft disponible',
    subtitle_en: 'New craft available',
    type: 'info',
  },
};

// ── Mapping catégorie → variant HarvestBurst ──

/**
 * CATEGORY_VARIANT — contrôle le niveau visuel du HarvestBurst.
 * golden   → soins bébé, rendez-vous (effets épiques)
 * rare     → cuisine, gratitude, budget (effets spéciaux)
 * ambient  → ménage, courses, routines, devoirs (effets courants)
 */
export const CATEGORY_VARIANT: Record<CategoryId, HarvestBurstVariant> = {
  bebe_soins: 'golden',
  rendez_vous: 'golden',
  cuisine_repas: 'rare',
  gratitude_famille: 'rare',
  budget_admin: 'rare',
  menage_quotidien: 'ambient',
  menage_hebdo: 'ambient',
  courses: 'ambient',
  enfants_routines: 'ambient',
  enfants_devoirs: 'ambient',
};

// ── Mapping catégorie → fonction haptic ───────

/**
 * CATEGORY_HAPTIC_FN — intensité haptique par catégorie.
 * light   → ménage (tâches de fond)
 * medium  → courses, routines, devoirs, budget (tâches régulières)
 * strong  → cuisine, gratitude (moments chaleureux)
 * golden  → soins bébé, rendez-vous (moments épiques)
 */
export const CATEGORY_HAPTIC_FN: Record<CategoryId, () => void | Promise<void>> = {
  menage_quotidien: hapticsEffectLight,
  menage_hebdo: hapticsEffectLight,
  courses: hapticsEffectMedium,
  enfants_routines: hapticsEffectMedium,
  enfants_devoirs: hapticsEffectMedium,
  budget_admin: hapticsEffectMedium,
  cuisine_repas: hapticsEffectStrong,
  gratitude_famille: hapticsEffectStrong,
  rendez_vous: hapticsEffectGolden,
  bebe_soins: hapticsEffectGolden,
};
