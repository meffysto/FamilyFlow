/**
 * story-scenes.ts — Extraction tolérante des scènes illustrées depuis la réponse Claude.
 *
 * Format de prompt compact (V3.1) :
 *   { panelIndex, archetype, sceneStart, highlights }
 * où `sceneStart` = les premiers mots EXACTS de la scène (typiquement 5 mots).
 * Le parser localise chaque scène via `indexOf(sceneStart)` dans le texte et
 * déduit la fin de la scène = début de la suivante (ou fin du texte pour la
 * dernière). Avantage : la réponse Claude n'a pas à dupliquer le texte complet
 * dans `scenes[]`, ce qui économise ~50% des tokens de réponse.
 *
 * Compat ascendante : si Claude renvoie l'ancien format `sceneText` (substring
 * complet), on l'utilise tel quel.
 */
import type { HighlightSpan, SceneArchetype, SceneSpec, StoryScenes } from './types';
import { canonicalizeArchetype } from './story-illustrations';

interface RawScene {
  panelIndex?: unknown;
  archetype?: unknown;
  /** V3.1 — 5 premiers mots de la scène (format compact) */
  sceneStart?: unknown;
  /** V3.0 — substring complet (format legacy, support en lecture) */
  sceneText?: unknown;
  highlights?: unknown;
}

/**
 * Convertit `parsed.scenes` brut en `StoryScenes` validé.
 *
 * Tolérance volontaire : tout élément invalide est ignoré silencieusement.
 * Retourne `null` si zéro scène utilisable (caller affiche fallback texte).
 */
export function extractScenesFromAIResponse(
  rawScenes: unknown,
  texte: string,
): StoryScenes | null {
  if (!Array.isArray(rawScenes) || rawScenes.length === 0) return null;

  // Étape 1 : pour chaque scène, calculer textStart via indexOf
  type Anchored = {
    archetype: SceneArchetype;
    textStart: number;
    /** Texte sceneText explicite (legacy) ou null (à déduire en étape 2) */
    explicitEnd: number | null;
    rawHighlights: unknown;
  };
  const anchored: Anchored[] = [];
  let searchCursor = 0;

  for (const r of rawScenes as RawScene[]) {
    if (!r || typeof r !== 'object') continue;
    if (typeof r.archetype !== 'string') continue;
    const archetype = canonicalizeArchetype(r.archetype);
    if (!archetype) continue;

    let textStart = -1;
    let explicitEnd: number | null = null;

    // V3.0 legacy — sceneText complet
    if (typeof r.sceneText === 'string' && r.sceneText.trim()) {
      const sceneText = r.sceneText.trim();
      textStart = findAtWordBoundary(texte, sceneText, searchCursor);
      if (textStart !== -1) explicitEnd = textStart + sceneText.length;
    }

    // V3.1 compact — sceneStart = premiers mots
    if (textStart === -1 && typeof r.sceneStart === 'string' && r.sceneStart.trim()) {
      const start = r.sceneStart.trim();
      textStart = findAtWordBoundary(texte, start, searchCursor);
    }

    if (textStart === -1) continue; // sceneStart introuvable — skip

    anchored.push({
      archetype,
      textStart,
      explicitEnd,
      rawHighlights: r.highlights,
    });
    // Avance le curseur (force ordre séquentiel)
    searchCursor = textStart + 1;
  }

  if (anchored.length === 0) return null;

  // Force la 1ère scène à démarrer en index 0 — évite que le tout début du
  // texte soit ignoré si Claude a renvoyé un sceneStart légèrement différent
  // du tout début. La 1ère scène DOIT couvrir l'ouverture.
  if (anchored[0].textStart > 0) {
    anchored[0].textStart = 0;
    anchored[0].explicitEnd = null; // ré-évalué via la suivante
  }

  // Étape 2 : déduire textEnd pour chaque scène
  // - explicitEnd si fourni (legacy sceneText)
  // - sinon textStart de la scène suivante
  // - dernière scène : texte.length
  const scenes: SceneSpec[] = [];
  for (let i = 0; i < anchored.length; i++) {
    const cur = anchored[i];
    const next = anchored[i + 1];
    const textEnd =
      cur.explicitEnd ??
      (next ? next.textStart : texte.length);

    if (textEnd <= cur.textStart) continue; // bornes invalides — skip

    const sceneText = texte.slice(cur.textStart, textEnd);
    const highlights: HighlightSpan[] = [];

    if (Array.isArray(cur.rawHighlights)) {
      for (const h of cur.rawHighlights) {
        if (typeof h !== 'string') continue;
        const trimmed = h.trim();
        if (!trimmed) continue;
        const idx = sceneText.indexOf(trimmed);
        if (idx === -1) continue;
        const startChar = idx;
        const endChar = idx + trimmed.length;
        const overlap = highlights.some(
          existing => startChar < existing.endChar && endChar > existing.startChar,
        );
        if (overlap) continue;
        highlights.push({ startChar, endChar, kind: 'keyword' });
      }
    }

    highlights.sort((a, b) => a.startChar - b.startChar);

    scenes.push({
      panelIndex: scenes.length + 1,
      archetype: cur.archetype,
      textStart: cur.textStart,
      textEnd,
      highlights,
    });
  }

  if (scenes.length === 0) return null;
  return { version: 1, scenes };
}

/**
 * Cherche `needle` dans `haystack` à partir de `from`, mais en privilégiant
 * un début de mot (caractère précédent = whitespace ou index 0).
 * Évite les coupes mid-mot quand un sceneStart court matche par accident
 * à l'intérieur d'un autre mot.
 */
function findAtWordBoundary(haystack: string, needle: string, from: number): number {
  // Pass 1 : à partir du curseur, frontière de mot stricte
  let idx = haystack.indexOf(needle, from);
  while (idx !== -1) {
    if (idx === 0 || /\s/.test(haystack.charAt(idx - 1))) return idx;
    idx = haystack.indexOf(needle, idx + 1);
  }
  // Pass 2 : depuis le début, frontière de mot
  idx = haystack.indexOf(needle);
  while (idx !== -1) {
    if (idx === 0 || /\s/.test(haystack.charAt(idx - 1))) return idx;
    idx = haystack.indexOf(needle, idx + 1);
  }
  // Pass 3 : fallback ultra-tolérant
  return haystack.indexOf(needle, from);
}
