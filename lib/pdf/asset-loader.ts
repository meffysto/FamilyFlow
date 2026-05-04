// lib/pdf/asset-loader.ts — Chargement base64 polices + illustrations print pour pipeline PDF.
// Cache mémoire `Map<string,string>` + `cachedFonts` pour éviter la double conversion base64
// (CONTEXT.md ligne 54 + RESEARCH.md §327-345, §858-877).
//
// TODO Wave 0 dette: PNG illustrations 2480x2480 sont des upscales sharp lanczos depuis WebP 800x800 (CONTEXT.md §206-212).
// À ré-générer en AI native (Midjourney HD / DALL-E 3) post-milestone si retours qualité Lulu réelle.

import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import type { SceneArchetype, StoryUniverseId } from '../types';
import { getPrintIllustrationModule } from './print-illustrations';

// require() statique des polices Andika (alignement avec assets/fonts/Andika/).
const ANDIKA_REGULAR_MODULE = require('../../assets/fonts/Andika/Andika-Regular.ttf');
const ANDIKA_BOLD_MODULE = require('../../assets/fonts/Andika/Andika-Bold.ttf');

interface FontsBase64 {
  andikaRegular: string;
  andikaBold: string;
}

let cachedFonts: FontsBase64 | null = null;
const illustrationCache = new Map<string, string>();

/**
 * Charge un asset (police ou image) en base64 string.
 * Mitigation Pitfall 6 RESEARCH.md §779-783 : downloadAsync() obligatoire avant readAsStringAsync,
 * sinon `localUri` peut rester null sur certains environnements.
 */
async function loadAssetAsBase64(moduleId: number): Promise<string> {
  const asset = Asset.fromModule(moduleId);
  await asset.downloadAsync();
  if (!asset.localUri) {
    throw new Error(`[pdf/asset-loader] Asset.localUri null après downloadAsync (moduleId=${moduleId})`);
  }
  return FileSystem.readAsStringAsync(asset.localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

/**
 * Charge les polices Andika (Regular + Bold) en base64 et les met en cache mémoire.
 * Au deuxième appel : retourne la MÊME référence (cache hit, pas de re-lecture disque).
 */
export async function loadFontsBase64(): Promise<FontsBase64> {
  if (cachedFonts) return cachedFonts;
  const [andikaRegular, andikaBold] = await Promise.all([
    loadAssetAsBase64(ANDIKA_REGULAR_MODULE),
    loadAssetAsBase64(ANDIKA_BOLD_MODULE),
  ]);
  cachedFonts = { andikaRegular, andikaBold };
  return cachedFonts;
}

/**
 * Charge une illustration print 2480×2480 en base64.
 * Retourne `null` si la combinaison (univers, archetype) n'est pas dans le catalogue print
 * (univers non-forêt MVP) — l'appelant doit alors basculer sur le mode B fallback.
 */
export async function loadIllustrationBase64(
  univers: StoryUniverseId,
  archetype: SceneArchetype,
): Promise<string | null> {
  const key = `${univers}-${archetype}`;
  const cached = illustrationCache.get(key);
  if (cached !== undefined) return cached;

  const moduleId = getPrintIllustrationModule(univers, archetype);
  if (moduleId === undefined) {
    if (__DEV__) {
      console.warn(`[pdf/asset-loader] Illustration print absente catalogue : ${key}`);
    }
    return null;
  }

  const base64 = await loadAssetAsBase64(moduleId);
  illustrationCache.set(key, base64);
  return base64;
}

/**
 * Pré-charge polices + illustrations forêt en parallèle.
 * Utilisé par Plan 49-03 pour mesurer la perf optimale (fonts + 6 PNG en parallèle).
 * No-op si tout est déjà cache hit.
 */
export async function preloadAllAssets(archetypes: SceneArchetype[]): Promise<void> {
  await Promise.all([
    loadFontsBase64(),
    ...archetypes.map((archetype) => loadIllustrationBase64('foret', archetype)),
  ]);
}

/**
 * Vide les deux caches mémoire (fonts + illustrations).
 * Utilisé par les tests Jest et les outils de debug.
 */
export function clearAssetCache(): void {
  cachedFonts = null;
  illustrationCache.clear();
}
