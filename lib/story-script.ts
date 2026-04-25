/**
 * story-script.ts — Helpers pour les scripts d'histoire structurés (V2 Mode Spectacle).
 *
 * Le script est produit par Claude au format JSON, sérialisé dans un sidecar
 * `<storyId>.script.json` à côté du `.md` dans le vault. Cette unité expose :
 * - parseStoryScript : tolérant aux JSON mal formés, normalise et filtre
 * - extractScriptFromAIResponse : extrait le champ `script` d'une réponse Claude
 */
import type { StoryAudioAlignment, StoryBeat, StoryScript, StorySfxTag } from './types';
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
 * V2.3 — Calcule le planning précis des SFX à partir de l'alignement
 * caractère→timestamp retourné par ElevenLabs.
 *
 * Algorithme :
 * 1. Curseur `pos` dans `alignment.chars` (texte tel qu'envoyé à l'API).
 * 2. Pour chaque beat narration/dialogue : avance `pos` à travers les chars
 *    correspondant à `beat.text` avec une tolérance (skip espaces/ponctuation).
 * 3. Pour chaque beat SFX : timestamp = `ends[pos - 1] + offset` (45ms).
 *
 * Tolérance : si un caractère du beat ne match pas exactement à `chars[pos]`,
 * on cherche en avant dans une fenêtre de 8 caractères. Si rien ne match, on
 * avance d'une position et on continue (résilient aux espaces, ponctuation,
 * accents normalisés différemment côté API).
 *
 * Retourne un planning `{ tag, atSec }[]` trié, ou `null` si l'alignment est
 * trop incohérent pour être exploitable (fallback ratio attendu).
 */
const SFX_OFFSET_AFTER_LAST_CHAR = 0.045; // 45ms — laisse la voix finir le mot
const SEARCH_WINDOW = 8;

export function computeSfxScheduleFromAlignment(
  script: StoryScript,
  alignment: StoryAudioAlignment,
): { tag: StorySfxTag; atSec: number }[] | null {
  if (!alignment.chars.length) return null;

  const schedule: { tag: StorySfxTag; atSec: number }[] = [];
  let pos = 0;
  let mismatchBudget = Math.max(40, Math.floor(alignment.chars.length * 0.05));

  // Avance le curseur d'un caractère cible — retourne true si trouvé/sauté
  const advanceOne = (target: string): boolean => {
    if (pos >= alignment.chars.length) return false;
    const norm = normalizeChar(target);
    if (!norm) return true; // caractère ignoré (espace de séparation)

    if (normalizeChar(alignment.chars[pos]) === norm) {
      pos++;
      return true;
    }

    // Recherche en avant dans une petite fenêtre
    const limit = Math.min(alignment.chars.length, pos + SEARCH_WINDOW);
    for (let p = pos + 1; p < limit; p++) {
      if (normalizeChar(alignment.chars[p]) === norm) {
        pos = p + 1;
        return true;
      }
    }

    // Mismatch — consomme du budget mais continue
    mismatchBudget--;
    if (mismatchBudget < 0) return false;
    pos++;
    return true;
  };

  for (const beat of script.beats) {
    if (beat.kind === 'narration' || beat.kind === 'dialogue') {
      for (let i = 0; i < beat.text.length; i++) {
        if (!advanceOne(beat.text[i])) {
          // Trop de mismatch — abandon
          return null;
        }
      }
      // Espace virtuel entre beats (cohérent avec flattenScriptToText)
      if (pos < alignment.chars.length && /\s/.test(alignment.chars[pos] ?? '')) {
        pos++;
      }
    } else if (beat.kind === 'sfx') {
      // Timestamp = fin du dernier caractère narré + offset
      const refIdx = Math.max(0, Math.min(alignment.ends.length - 1, pos - 1));
      const endSec = alignment.ends[refIdx];
      const atSec = (Number.isFinite(endSec) ? endSec : 0) + SFX_OFFSET_AFTER_LAST_CHAR;
      schedule.push({ tag: beat.tag, atSec });
    } else if (beat.kind === 'pause') {
      // Une pause n'a pas d'ancre dans l'audio — on ignore (le TTS gère ses pauses)
    }
  }

  if (schedule.length === 0) return [];
  // Tri par sécurité (devrait déjà être ordonné)
  schedule.sort((a, b) => a.atSec - b.atSec);
  return schedule;
}

/**
 * Normalise un caractère pour comparaison tolérante :
 * - lowercase
 * - retire accents (NFD + strip combining marks)
 * - traite tous les espaces comme équivalents (retourne '' pour skip propre)
 */
function normalizeChar(c: string): string {
  if (!c) return '';
  if (/\s/.test(c)) return ' ';
  return c
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
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
