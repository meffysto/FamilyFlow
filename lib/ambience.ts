/**
 * ambience.ts — Bibliothèque d'ambiances sonores pour le Mode Spectacle.
 *
 * Un MP3 loopable par univers Stories, bundlé dans l'app. Zéro coût ElevenLabs
 * au runtime : la génération se fait une seule fois via `scripts/generate-ambience-library.ts`
 * en lisant `assets/stories/ambience/manifest.json`, puis les MP3 sont commités
 * et chargés ici via `require()` statique.
 *
 * Tant qu'un univers n'a pas son MP3 bundlé, le mapping renvoie `undefined` et
 * le Mode Spectacle joue simplement la voix sans ambiance (fallback gracieux).
 */
import type { ImageSourcePropType } from 'react-native';
import type { StoryUniverseId } from './types';

/**
 * Mapping univers → asset MP3 ambiance.
 *
 * Ajouter `universId: require('../assets/stories/ambience/xxx.mp3')`
 * au fur et à mesure que les fichiers sont générés et commités.
 * Un univers absent = Mode Spectacle actif mais sans piste d'ambiance.
 */
export const STORY_AMBIENCE_ASSETS: Partial<Record<StoryUniverseId, ImageSourcePropType>> = {
  espace:        require('../assets/stories/ambience/espace.mp3'),
  ocean:         require('../assets/stories/ambience/ocean.mp3'),
  foret:         require('../assets/stories/ambience/foret.mp3'),
  dinosaures:    require('../assets/stories/ambience/dinosaures.mp3'),
  princesse:     require('../assets/stories/ambience/princesse.mp3'),
  'super-heros': require('../assets/stories/ambience/super-heros.mp3'),
  pirates:       require('../assets/stories/ambience/pirates.mp3'),
  robots:        require('../assets/stories/ambience/robots.mp3'),
  surprise:      require('../assets/stories/ambience/surprise.mp3'),
};

/** Volume de la piste d'ambiance sous la voix narrée (0-1) */
export const AMBIENCE_VOLUME = 0.4;

/** Durée du fade-out final avant endormissement (secondes) */
export const AMBIENCE_FADE_OUT_SECONDS = 15;

/** Durée du fade-in au démarrage (secondes) */
export const AMBIENCE_FADE_IN_SECONDS = 2;

/** True si au moins un asset est bundlé (active le toggle UI utilement). */
export function hasAmbienceAsset(universId: StoryUniverseId): boolean {
  return STORY_AMBIENCE_ASSETS[universId] !== undefined;
}
