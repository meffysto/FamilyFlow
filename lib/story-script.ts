/**
 * story-script.ts — Helpers pour les scripts d'histoire structurés (V2 Mode Spectacle).
 *
 * Le script est produit par Claude au format JSON, sérialisé dans un sidecar
 * `<storyId>.script.json` à côté du `.md` dans le vault. Cette unité expose :
 * - parseStoryScript : tolérant aux JSON mal formés, normalise et filtre
 * - extractScriptFromAIResponse : extrait le champ `script` d'une réponse Claude
 */
import type { StoryBeat, StoryScript, StorySfxTag } from './types';
import { hasSfxAsset } from './sfx';

/**
 * Parse un script depuis du JSON brut (lecture sidecar ou réponse IA).
 * Tolérant : accepte du bruit, des champs en trop, des beats invalides
 * (filtrés silencieusement). Renvoie null si la structure est inutilisable.
 */
export function parseStoryScript(raw: string | unknown): StoryScript | null {
  let data: unknown;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch {
      return null;
    }
  } else {
    data = raw;
  }

  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  const beatsRaw = obj.beats;
  if (!Array.isArray(beatsRaw)) return null;

  const beats: StoryBeat[] = [];
  for (const b of beatsRaw) {
    if (!b || typeof b !== 'object') continue;
    const beat = b as Record<string, unknown>;
    switch (beat.kind) {
      case 'narration': {
        const text = typeof beat.text === 'string' ? beat.text.trim() : '';
        if (!text) continue;
        const emotion = isValidEmotion(beat.emotion) ? beat.emotion : undefined;
        beats.push({ kind: 'narration', text, emotion });
        break;
      }
      case 'dialogue': {
        const text = typeof beat.text === 'string' ? beat.text.trim() : '';
        const speaker = typeof beat.speaker === 'string' ? beat.speaker : 'character';
        if (!text) continue;
        const emotion = isValidEmotion(beat.emotion) ? beat.emotion : undefined;
        beats.push({ kind: 'dialogue', speaker, text, emotion });
        break;
      }
      case 'sfx': {
        if (typeof beat.tag !== 'string') continue;
        // Skip silencieusement les tags inconnus ou non bundlés
        if (!hasSfxAsset(beat.tag as StorySfxTag)) continue;
        beats.push({ kind: 'sfx', tag: beat.tag as StorySfxTag });
        break;
      }
      case 'pause': {
        const dur = Number(beat.durationSec);
        if (!Number.isFinite(dur) || dur <= 0) continue;
        beats.push({ kind: 'pause', durationSec: Math.min(dur, 10) });
        break;
      }
      default:
        // beat sans kind reconnu — skip
        break;
    }
  }

  if (beats.length === 0) return null;
  return { version: 2, beats };
}

function isValidEmotion(v: unknown): v is 'calm' | 'excited' | 'scared' | 'tender' | 'playful' | 'mysterious' {
  return typeof v === 'string'
    && ['calm', 'excited', 'scared', 'tender', 'playful', 'mysterious'].includes(v);
}

/**
 * Reconstruit le texte narratif (concat des beats narration/dialogue) depuis
 * un script. Sert à valider que le texte du `.md` correspond bien à ce que
 * Claude a balisé, ou à reconstruire si besoin.
 */
export function flattenScriptToText(script: StoryScript): string {
  return script.beats
    .filter(b => b.kind === 'narration' || b.kind === 'dialogue')
    .map(b => (b as { text: string }).text)
    .join(' ')
    .trim();
}

/**
 * Liste les tags SFX présents dans le script (deduplication, ordre conservé).
 * Utile pour précharger uniquement les SFX nécessaires côté player.
 */
export function getSfxTagsFromScript(script: StoryScript): StorySfxTag[] {
  const seen = new Set<StorySfxTag>();
  const out: StorySfxTag[] = [];
  for (const b of script.beats) {
    if (b.kind === 'sfx' && !seen.has(b.tag)) {
      seen.add(b.tag);
      out.push(b.tag);
    }
  }
  return out;
}
