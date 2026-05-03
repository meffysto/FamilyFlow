/**
 * story-illustrations.ts — Catalogue d'illustrations bundlées pour le mode picture-book.
 *
 * Pour le MVP, seul l'univers `foret` a un set complet de 6 illustrations
 * (une par archétype). Les autres univers tombent en fallback texte-seul
 * (composant StoryPage rend juste le texte sur fond cream).
 *
 * Pour ajouter un univers :
 *   1. Générer 6 illustrations couvrant les archétypes (cf. preview HTML
 *      .planning/quick/story-typo-mockup/preview.html)
 *   2. Compresser en webp 800x800 (~150 KB chacun)
 *   3. Déposer dans assets/stories/illustrations/<univers>/<archetype>.webp
 *   4. Ajouter l'entrée dans ILLUSTRATIONS_CATALOG ci-dessous
 */
import type { ImageSourcePropType } from 'react-native';
import type { SceneArchetype, StoryUniverseId } from './types';

/**
 * Catalogue d'illustrations bundlées. Clé = `${universId}-${archetype}`.
 * Volontairement plat pour `require()` statique (Metro bundler exige des
 * littéraux pour suivre les assets).
 */
const ILLUSTRATIONS_CATALOG: Partial<Record<string, ImageSourcePropType>> = {
  // Forêt enchantée — set complet (MVP)
  'foret-paysage':    require('../assets/stories/illustrations/foret/paysage.webp'),
  'foret-rencontre':  require('../assets/stories/illustrations/foret/rencontre.webp'),
  'foret-decouverte': require('../assets/stories/illustrations/foret/decouverte.webp'),
  'foret-vulnerable': require('../assets/stories/illustrations/foret/vulnerable.webp'),
  'foret-echange':    require('../assets/stories/illustrations/foret/echange.webp'),
  'foret-etreinte':   require('../assets/stories/illustrations/foret/etreinte.webp'),
};

/**
 * Retourne l'illustration bundlée pour {univers, archétype}, ou null si
 * absente. Le composant StoryPage gère gracieusement le cas null en
 * rendant uniquement le texte (fond cream + Patrick Hand).
 */
export function getIllustration(
  universId: StoryUniverseId,
  archetype: SceneArchetype,
): ImageSourcePropType | null {
  return ILLUSTRATIONS_CATALOG[`${universId}-${archetype}`] ?? null;
}

/**
 * Retourne `true` si l'univers a au moins une illustration. Utile pour
 * afficher un badge "📖 illustré" sur la liste des histoires.
 */
export function isUniverseIllustrated(universId: StoryUniverseId): boolean {
  return Object.keys(ILLUSTRATIONS_CATALOG).some(k => k.startsWith(`${universId}-`));
}

/** Liste fermée des archétypes — exposée pour validation côté parser/prompt. */
export const SCENE_ARCHETYPES: readonly SceneArchetype[] = [
  'paysage',
  'rencontre',
  'decouverte',
  'vulnerable',
  'echange',
  'etreinte',
] as const;

/** Normalise une string (lowercase + retire accents) pour matcher tolérant côté Claude */
function normalizeArchetype(v: string): string {
  return v.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Validation tolérante : accepte `découverte` / `vulnérable` / etc. en plus
 * des formes sans accent. Claude oublie parfois le hint "no accent" du prompt.
 */
export function isValidArchetype(v: unknown): v is SceneArchetype {
  if (typeof v !== 'string') return false;
  const norm = normalizeArchetype(v);
  return (SCENE_ARCHETYPES as readonly string[]).includes(norm);
}

/** Normalise un archétype Claude (avec ou sans accent) vers la forme canonique. */
export function canonicalizeArchetype(v: string): SceneArchetype | null {
  const norm = normalizeArchetype(v);
  if ((SCENE_ARCHETYPES as readonly string[]).includes(norm)) {
    return norm as SceneArchetype;
  }
  return null;
}
