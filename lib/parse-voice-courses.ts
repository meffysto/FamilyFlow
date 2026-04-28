/**
 * parse-voice-courses.ts — Parseur de transcript vocal vers items de courses
 *
 * Découpe un transcript en items individuels, extrait quantités et noms,
 * et affecte une catégorie via categorizeIngredient.
 */

import { categorizeIngredient } from './cooklang';

export interface VoiceCourseItem {
  text: string;
  name: string;
  quantity: number | null;
  section: string;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Nombres en lettres FR → valeur numérique */
const FR_NUMBER_WORDS: Record<string, number> = {
  'deux': 2, 'trois': 3, 'quatre': 4, 'cinq': 5,
  'six': 6, 'sept': 7, 'huit': 8, 'neuf': 9, 'dix': 10,
  'onze': 11, 'douze': 12, 'treize': 13, 'quatorze': 14, 'quinze': 15,
  'seize': 16, 'vingt': 20, 'trente': 30, 'quarante': 40, 'cinquante': 50,
};

const NUMBER_WORD_KEYS = Object.keys(FR_NUMBER_WORDS).join('|');

/** Détecte un nombre en lettres en début de segment : "cinq oeufs" → remplace par "5 oeufs" */
const NUMBER_WORD_START_RE = new RegExp(`^(${NUMBER_WORD_KEYS})\\s+(.+)`, 'i');

/** Segment qui ne contient QUE un nombre (chiffre ou lettres) — fragment orphelin */
const LONE_NUMBER_RE = new RegExp(`^(\\d+|${NUMBER_WORD_KEYS})$`, 'i');

/** Séparateurs principaux entre items dictés */
const PRIMARY_SPLIT_RE = /\s+et\s+|,\s*|;\s*|\.\s+|\n+/i;

/** Unités de mesure — leur présence en milieu de segment signale un nouvel article */
const UNITS = 'g|kg|ml|cl|dl|l|paquets?|sachets?|boîtes?|boites?|bouteilles?|tranches?|gousses?|brins?|bottes?';

/**
 * Split secondaire : détecte "une quiche 500g de farine" → ["une quiche", "500g de farine"]
 * Ne s'applique que si la quantité n'est PAS en début de segment (sinon c'est l'article en entier).
 */
const INLINE_QTY_SPLIT_RE = new RegExp(
  `(?<=\\S)\\s+(?=\\d+(?:[.,]\\d+)?\\s*(?:${UNITS})\\b)`,
  'i',
);

/** Déterminants à retirer du nom quand pas de quantité */
const DETERMINANT_RE = /^(du|de la|de l['']|des|un|une|le|la|les)\s+/i;

/**
 * Extraction quantité + unité + nom
 * Ex : "500g de farine", "2 sachets de levure", "3 oeufs"
 * Groupe 1 : chiffre, Groupe 2 : unité (optionnel), Groupe 3 : nom
 */
const QTY_RE = new RegExp(
  `^(\\d+(?:[.,]\\d+)?)\\s*(${UNITS})?\\s*(?:de\\s+|d[''])?(.+)`,
  'i',
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeForDedup(name: string): string {
  return name.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/** Remplace un nombre en lettres en début de segment par sa valeur chiffre */
function resolveNumberWord(seg: string): string {
  const m = seg.match(NUMBER_WORD_START_RE);
  if (!m) return seg;
  const num = FR_NUMBER_WORDS[m[1].toLowerCase()];
  return `${num} ${m[2]}`;
}

// ─── Parser principal ─────────────────────────────────────────────────────────

/**
 * Parse un transcript vocal en liste d'items de courses.
 * Gère les nombres en lettres ("cinq oeufs"), les fragments orphelins ("cinq" seul),
 * et les items collés sans séparateur ("une quiche 500g de farine").
 */
export function parseVoiceCourses(transcript: string): VoiceCourseItem[] {
  if (!transcript?.trim()) return [];

  // Étape 1 : split primaire sur séparateurs FR explicites
  const primary = transcript
    .split(PRIMARY_SPLIT_RE)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  // Étape 2 : fusionner les nombres orphelins avec le segment suivant
  // "cinq" + "oeufs" → "cinq oeufs", "5" + "tomates" → "5 tomates"
  const merged: string[] = [];
  for (let i = 0; i < primary.length; i++) {
    if (LONE_NUMBER_RE.test(primary[i]) && i + 1 < primary.length) {
      primary[i + 1] = `${primary[i]} ${primary[i + 1]}`;
      continue;
    }
    merged.push(primary[i]);
  }

  // Étape 3 : split secondaire sur quantité+unité embarquée en milieu de segment
  // "une quiche 500g de farine" → ["une quiche", "500g de farine"]
  const segments: string[] = [];
  for (const seg of merged) {
    try {
      const parts = seg.split(INLINE_QTY_SPLIT_RE).map(s => s.trim()).filter(s => s.length > 0);
      segments.push(...parts);
    } catch {
      // lookbehind non supporté sur certains moteurs JS — fallback sans split secondaire
      segments.push(seg);
    }
  }

  // Étape 4 : parser chaque segment en item
  const seen = new Set<string>();
  const result: VoiceCourseItem[] = [];

  for (const segment of segments) {
    // Convertir nombre en lettres → chiffre
    const normalized = resolveNumberWord(segment);

    let quantity: number | null = null;
    let unit = '';
    let name = normalized;

    const m = normalized.match(QTY_RE);
    if (m) {
      quantity = parseFloat(m[1].replace(',', '.'));
      unit = (m[2] ?? '').trim();
      name = m[3].trim();
    } else {
      // Pas de quantité → retirer le déterminant
      name = name.replace(DETERMINANT_RE, '').trim();
    }

    if (name.length < 2) continue;

    const dedupKey = normalizeForDedup(name);
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);

    // Reconstruction du texte propre avec unité si présente
    let text: string;
    if (quantity !== null) {
      const qty = quantity % 1 === 0 ? Math.round(quantity) : quantity;
      text = unit ? `${qty}${unit} de ${name}` : `${qty} ${name}`;
    } else {
      text = capitalize(name);
    }

    result.push({ text, name, quantity, section: categorizeIngredient(name) });
  }

  return result;
}
